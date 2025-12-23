import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to get email configuration from app_settings
interface EmailConfigSettings {
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpTls: boolean;
  dkimSelector: string;
  dkimPrivateKey: string;
  dkimDomain: string;
}

async function getEmailConfig(): Promise<EmailConfigSettings> {
  const defaults: EmailConfigSettings = {
    senderName: "Sparkly",
    senderEmail: "noreply@sparkly.hr",
    replyToEmail: "",
    smtpHost: "",
    smtpPort: "587",
    smtpUsername: "",
    smtpPassword: "",
    smtpTls: true,
    dkimSelector: "",
    dkimPrivateKey: "",
    dkimDomain: "",
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const settingKeys = [
        "email_sender_name", "email_sender_email", "email_reply_to",
        "smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_tls",
        "dkim_selector", "dkim_private_key", "dkim_domain"
      ];
      
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .in("setting_key", settingKeys);
      
      if (!error && data && data.length > 0) {
        data.forEach((setting: { setting_key: string; setting_value: string }) => {
          switch (setting.setting_key) {
            case "email_sender_name": defaults.senderName = setting.setting_value || defaults.senderName; break;
            case "email_sender_email": defaults.senderEmail = setting.setting_value || defaults.senderEmail; break;
            case "email_reply_to": defaults.replyToEmail = setting.setting_value; break;
            case "smtp_host": defaults.smtpHost = setting.setting_value; break;
            case "smtp_port": defaults.smtpPort = setting.setting_value || defaults.smtpPort; break;
            case "smtp_username": defaults.smtpUsername = setting.setting_value; break;
            case "smtp_password": defaults.smtpPassword = setting.setting_value; break;
            case "smtp_tls": defaults.smtpTls = setting.setting_value === "true"; break;
            case "dkim_selector": defaults.dkimSelector = setting.setting_value; break;
            case "dkim_private_key": defaults.dkimPrivateKey = setting.setting_value; break;
            case "dkim_domain": defaults.dkimDomain = setting.setting_value; break;
          }
        });
        console.log("Loaded email config from database:", {
          senderName: defaults.senderName,
          senderEmail: defaults.senderEmail,
          smtpHost: defaults.smtpHost,
          smtpPort: defaults.smtpPort,
          hasDkim: !!defaults.dkimDomain,
        });
      }
    }
  } catch (error) {
    console.error("Error fetching email config from database:", error);
  }
  
  return defaults;
}

// UTF-8 safe base64 encoding (handles any Unicode string)
function utf8ToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Safe base64 encoding for SMTP AUTH (RFC 4954)
// SMTP AUTH LOGIN uses base64, but the credential bytes should be UTF-8 encoded first
function encodeCredential(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function hasSmtpConfigured(config: EmailConfigSettings): boolean {
  return !!(config.smtpHost && config.smtpUsername && config.smtpPassword);
}

function isEmailServiceConfigured(config: EmailConfigSettings): boolean {
  return hasSmtpConfigured(config);
}

// Encode subject line for UTF-8 support (RFC 2047)
function encodeSubject(subject: string): string {
  if (!/^[\x00-\x7F]*$/.test(subject)) {
    const encoded = utf8ToBase64(subject);
    return `=?UTF-8?B?${encoded}?=`;
  }
  return subject;
}

// Encode display name for UTF-8 support (RFC 2047)
function encodeDisplayName(name: string): string {
  if (!/^[\x00-\x7F]*$/.test(name)) {
    const encoded = utf8ToBase64(name);
    return `=?UTF-8?B?${encoded}?=`;
  }
  return name;
}

// Raw SMTP implementation with proper UTF-8 authentication support
class RawSMTPClient {
  private conn: Deno.Conn | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private buffer = "";

  constructor(private config: EmailConfigSettings) {}

  private async readLine(): Promise<string> {
    while (!this.buffer.includes("\r\n")) {
      if (!this.reader) throw new Error("Connection not established");
      const { value, done } = await this.reader.read();
      if (done) throw new Error("Connection closed");
      this.buffer += this.decoder.decode(value);
    }
    const lineEnd = this.buffer.indexOf("\r\n");
    const line = this.buffer.slice(0, lineEnd);
    this.buffer = this.buffer.slice(lineEnd + 2);
    return line;
  }

  private async readResponse(): Promise<{ code: number; lines: string[] }> {
    const lines: string[] = [];
    let code = 0;
    
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      code = parseInt(line.slice(0, 3), 10);
      if (line.length >= 4 && line[3] !== "-") break;
    }
    
    return { code, lines };
  }

  private async writeLine(line: string): Promise<void> {
    if (!this.writer) throw new Error("Connection not established");
    await this.writer.write(this.encoder.encode(line + "\r\n"));
  }

  private async command(cmd: string, expectedCodes: number[]): Promise<{ code: number; lines: string[] }> {
    await this.writeLine(cmd);
    const response = await this.readResponse();
    if (!expectedCodes.includes(response.code)) {
      throw new Error(`SMTP error: expected ${expectedCodes.join(" or ")}, got ${response.code}: ${response.lines.join(" ")}`);
    }
    return response;
  }

  async connect(): Promise<void> {
    const port = parseInt(this.config.smtpPort, 10) || 587;
    
    if (port === 465 || this.config.smtpTls) {
      this.conn = await Deno.connectTls({
        hostname: this.config.smtpHost,
        port,
      });
    } else {
      this.conn = await Deno.connect({
        hostname: this.config.smtpHost,
        port,
      });
    }

    this.reader = this.conn.readable.getReader();
    this.writer = this.conn.writable.getWriter();

    const greeting = await this.readResponse();
    if (greeting.code !== 220) {
      throw new Error(`SMTP greeting error: ${greeting.lines.join(" ")}`);
    }

    await this.command(`EHLO localhost`, [250]);
    await this.command("AUTH LOGIN", [334]);
    await this.command(encodeCredential(this.config.smtpUsername), [334]);
    await this.command(encodeCredential(this.config.smtpPassword), [235]);
  }

  async send(from: string, to: string[], subject: string, html: string, replyTo?: string): Promise<void> {
    const fromEmail = from.match(/<(.+)>$/)?.[1] || from;
    
    await this.command(`MAIL FROM:<${fromEmail}>`, [250]);
    
    for (const recipient of to) {
      await this.command(`RCPT TO:<${recipient}>`, [250]);
    }
    
    await this.command("DATA", [354]);

    const date = new Date().toUTCString();
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${this.config.smtpHost}>`;
    
    const headers = [
      `From: ${from}`,
      `To: ${to.join(", ")}`,
      `Subject: ${encodeSubject(subject)}`,
      `Date: ${date}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
    ];
    
    if (replyTo) {
      headers.push(`Reply-To: ${replyTo}`);
    }

    for (const header of headers) {
      await this.writeLine(header);
    }
    
    await this.writeLine("");
    
    const bodyBase64 = utf8ToBase64(html);
    const lines = bodyBase64.match(/.{1,76}/g) || [];
    for (const line of lines) {
      await this.writeLine(line);
    }
    
    const endResponse = await this.command(".", [250]);
    console.log("Email accepted:", endResponse.lines[0]);
  }

  async close(): Promise<void> {
    try { await this.command("QUIT", [221]); } catch {}
    try {
      this.reader?.releaseLock();
      this.writer?.releaseLock();
      this.conn?.close();
    } catch {}
  }
}

// Send email via SMTP with retry logic
interface SendEmailParams {
  from: string;
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendEmailWithRetry(
  config: EmailConfigSettings,
  emailParams: SendEmailParams
): Promise<{ success: boolean; error: string | null; attempts: number; messageId?: string }> {
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`Email send attempt ${attempt}/${MAX_RETRIES} (smtp) to: ${emailParams.to.join(", ")}`);

    const client = new RawSMTPClient(config);
    
    try {
      await client.connect();
      await client.send(
        emailParams.from,
        emailParams.to,
        emailParams.subject,
        emailParams.html,
        emailParams.replyTo
      );
      await client.close();

      console.log(`Email sent successfully on attempt ${attempt}`);
      return { success: true, error: null, attempts: attempt, messageId: `smtp-${Date.now()}` };
    } catch (error: any) {
      lastError = error?.message || "Unknown email error";
      console.error(`Email send attempt ${attempt} failed:`, lastError);
      try { await client.close(); } catch {}

      if (attempt < MAX_RETRIES) {
        const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`Waiting ${delayMs}ms before retry...`);
        await delay(delayMs);
      }
    }
  }

  console.error(`All ${MAX_RETRIES} email attempts failed`);
  return { success: false, error: lastError, attempts: MAX_RETRIES };
}

// HTML sanitization to prevent injection attacks
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char);
}

// In-memory rate limiting
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIP(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  
  const realIP = req.headers.get("x-real-ip");
  if (realIP) return realIP;
  
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  if (cfConnectingIP) return cfConnectingIP;
  
  return "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; remainingRequests: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now - value.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remainingRequests: MAX_REQUESTS_PER_WINDOW - 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
  }
  
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remainingRequests: 0, resetTime: entry.windowStart + RATE_LIMIT_WINDOW_MS };
  }
  
  entry.count++;
  rateLimitMap.set(ip, entry);
  return { allowed: true, remainingRequests: MAX_REQUESTS_PER_WINDOW - entry.count, resetTime: entry.windowStart + RATE_LIMIT_WINDOW_MS };
}

// Email translations
const emailTranslations: Record<string, {
  subject: string;
  yourResults: string;
  outOf: string;
  points: string;
  keyInsights: string;
  wantToImprove: string;
  ctaDescription: string;
  visitSparkly: string;
  newQuizSubmission: string;
  userEmail: string;
  score: string;
  resultCategory: string;
  leadershipOpenMindedness: string;
  openMindednessOutOf: string;
}> = {
  en: {
    subject: 'Your Team Performance Results',
    yourResults: 'Your Team Performance Results',
    outOf: 'out of',
    points: 'points',
    keyInsights: 'Key Insights',
    wantToImprove: 'Ready for Precise Employee Assessment?',
    ctaDescription: 'This quiz provides a general overview. For accurate, in-depth analysis of your team\'s performance and actionable improvement strategies, continue with professional testing.',
    visitSparkly: 'Continue to Sparkly.hr',
    newQuizSubmission: 'New Quiz Submission',
    userEmail: 'User Email',
    score: 'Score',
    resultCategory: 'Result Category',
    leadershipOpenMindedness: 'Open-Minded Leadership',
    openMindednessOutOf: 'out of 4',
  },
  et: {
    subject: 'Sinu meeskonna tulemuslikkuse tulemused',
    yourResults: 'Sinu meeskonna tulemuslikkuse tulemused',
    outOf: 'punkti',
    points: 'punktist',
    keyInsights: 'Peamised tähelepanekud',
    wantToImprove: 'Valmis täpseks töötajate hindamiseks?',
    ctaDescription: 'See küsimustik annab üldise ülevaate. Täpse ja põhjaliku analüüsi ning praktiliste parendusstrateegiate saamiseks jätka professionaalse testimisega.',
    visitSparkly: 'Jätka Sparkly.hr lehele',
    newQuizSubmission: 'Uus küsitluse vastus',
    userEmail: 'Kasutaja e-post',
    score: 'Skoor',
    resultCategory: 'Tulemuse kategooria',
    leadershipOpenMindedness: 'Avatud mõtlemisega juhtimine',
    openMindednessOutOf: '4-st',
  },
  de: {
    subject: 'Ihre Team-Leistungsergebnisse',
    yourResults: 'Ihre Team-Leistungsergebnisse',
    outOf: 'von',
    points: 'Punkten',
    keyInsights: 'Wichtige Erkenntnisse',
    wantToImprove: 'Bereit für eine präzise Mitarbeiterbewertung?',
    ctaDescription: 'Dieses Quiz bietet einen allgemeinen Überblick. Für eine genaue, tiefgehende Analyse der Leistung Ihres Teams und umsetzbare Verbesserungsstrategien, fahren Sie mit professionellen Tests fort.',
    visitSparkly: 'Weiter zu Sparkly.hr',
    newQuizSubmission: 'Neue Quiz-Einreichung',
    userEmail: 'Benutzer-E-Mail',
    score: 'Punktzahl',
    resultCategory: 'Ergebniskategorie',
    leadershipOpenMindedness: 'Aufgeschlossene Führung',
    openMindednessOutOf: 'von 4',
  },
};

interface QuizResultsRequest {
  email: string;
  totalScore: number;
  maxScore: number;
  resultTitle: string;
  resultDescription: string;
  insights: string[];
  language?: string;
  answers?: unknown;
  opennessScore?: number;
  opennessMaxScore?: number;
  opennessTitle?: string;
  opennessDescription?: string;
  quizId?: string;
  templateOverride?: {
    sender_name?: string;
    sender_email?: string;
    subject?: string;
  };
}

// Dynamic content from quiz_result_levels and quizzes tables
interface DynamicEmailContent {
  resultTitle: string;
  resultDescription: string;
  insights: string[];
  ctaTitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaUrl: string;
  emoji: string;
}

// Helper function to get localized value with fallback chain
function getLocalizedValue(
  jsonObj: Record<string, string> | null | undefined,
  language: string,
  primaryLanguage: string = 'en',
  fallback: string = ''
): string {
  if (!jsonObj) return fallback;
  return jsonObj[language] || jsonObj[primaryLanguage] || jsonObj['en'] || fallback;
}

// Fetch dynamic content from quiz_result_levels and cta_templates for ALL quizzes
async function fetchDynamicEmailContent(
  supabase: any,
  quizId: string,
  score: number,
  language: string,
  ctaTemplateId?: string | null
): Promise<DynamicEmailContent | null> {
  try {
    console.log(`Fetching dynamic content for quiz ${quizId}, score ${score}, language ${language}, ctaTemplateId ${ctaTemplateId || 'none'}`);
    
    // Fetch quiz info for primary language
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('slug, primary_language, cta_title, cta_description, cta_text, cta_url')
      .eq('id', quizId)
      .single();
    
    if (quizError || !quiz) {
      console.log('Could not fetch quiz info:', quizError?.message);
      return null;
    }
    
    const primaryLang = quiz.primary_language || 'en';
    console.log(`Quiz ${quiz.slug} - primary language: ${primaryLang}, requested: ${language}`);
    
    // Fetch result level for this score (works for ALL quizzes)
    const { data: resultLevel, error: levelError } = await supabase
      .from('quiz_result_levels')
      .select('title, description, insights, emoji')
      .eq('quiz_id', quizId)
      .lte('min_score', score)
      .gte('max_score', score)
      .limit(1)
      .maybeSingle();
    
    if (levelError) {
      console.log('Error fetching result level:', levelError.message);
      return null;
    }
    
    if (!resultLevel) {
      console.log(`No result level found for score ${score}`);
      return null;
    }

    // Priority 1: Fetch CTA template linked to email template (if provided)
    let ctaTemplate = null;
    if (ctaTemplateId) {
      const { data: linkedCta, error: linkedCtaError } = await supabase
        .from('cta_templates')
        .select('cta_title, cta_description, cta_text, cta_url')
        .eq('id', ctaTemplateId)
        .maybeSingle();
      
      if (!linkedCtaError && linkedCta) {
        ctaTemplate = linkedCta;
        console.log('Using CTA linked to email template:', ctaTemplateId);
      } else if (linkedCtaError) {
        console.log('Error fetching linked CTA template:', linkedCtaError.message);
      }
    }
    
    // Priority 2: Fetch live CTA template for this quiz (fallback)
    if (!ctaTemplate) {
      const { data: liveCta, error: liveCtaError } = await supabase
        .from('cta_templates')
        .select('cta_title, cta_description, cta_text, cta_url')
        .eq('quiz_id', quizId)
        .eq('is_live', true)
        .maybeSingle();
      
      if (!liveCtaError && liveCta) {
        ctaTemplate = liveCta;
        console.log('Using live CTA for quiz');
      } else if (liveCtaError) {
        console.log('Error fetching live CTA template:', liveCtaError.message);
      }
    }

    // Use CTA from cta_templates if available, fallback to quizzes table
    const ctaSource = ctaTemplate || quiz;
    
    // Process insights - they can be array of localized objects {en: "...", et: "..."} 
    let processedInsights: string[] = [];
    if (Array.isArray(resultLevel.insights)) {
      processedInsights = resultLevel.insights.map((insight: any) => {
        if (typeof insight === 'string') {
          return insight;
        }
        if (typeof insight === 'object' && insight !== null) {
          // Localized insight object
          return insight[language] || insight[primaryLang] || insight['en'] || '';
        }
        return '';
      }).filter((i: string) => i.trim() !== '');
    }
    
    // Build dynamic content with fallback chain
    const dynamicContent: DynamicEmailContent = {
      resultTitle: getLocalizedValue(resultLevel.title, language, primaryLang, 'Your Result'),
      resultDescription: getLocalizedValue(resultLevel.description, language, primaryLang, ''),
      insights: processedInsights,
      ctaTitle: getLocalizedValue(ctaSource.cta_title, language, primaryLang, ''),
      ctaDescription: getLocalizedValue(ctaSource.cta_description, language, primaryLang, ''),
      ctaButtonText: getLocalizedValue(ctaSource.cta_text, language, primaryLang, 'Continue to Sparkly.hr'),
      ctaUrl: ctaSource.cta_url || 'https://sparkly.hr',
      emoji: resultLevel.emoji || '🌟',
    };
    
    console.log('Dynamic content fetched successfully:', {
      resultTitle: dynamicContent.resultTitle,
      hasInsights: dynamicContent.insights.length,
      ctaTitle: dynamicContent.ctaTitle || '(none)',
      ctaSource: ctaTemplate ? 'cta_templates' : 'quizzes',
    });
    
    return dynamicContent;
  } catch (error: any) {
    console.error('Error in fetchDynamicEmailContent:', error.message);
    return null;
  }
}

// Fetch open-mindedness result level based on score
async function fetchOpenMindednessResult(
  supabase: any,
  quizId: string,
  score: number,
  language: string,
  primaryLang: string
): Promise<{ title: string; description: string } | null> {
  try {
    const { data: omLevel, error } = await supabase
      .from('open_mindedness_result_levels')
      .select('title, description')
      .eq('quiz_id', quizId)
      .lte('min_score', score)
      .gte('max_score', score)
      .limit(1)
      .maybeSingle();
    
    if (error || !omLevel) {
      console.log('No OM result level found for score:', score);
      return null;
    }
    
    return {
      title: getLocalizedValue(omLevel.title, language, primaryLang, ''),
      description: getLocalizedValue(omLevel.description, language, primaryLang, ''),
    };
  } catch (e) {
    console.error('Error fetching OM result:', e);
    return null;
  }
}

// Helper function to build email HTML
interface EmailData {
  totalScore: number;
  maxScore: number;
  resultTitle: string;
  resultDescription: string;
  insights: string[];
  opennessScore?: number;
  opennessMaxScore: number;
  opennessTitle: string;
  opennessDescription: string;
  email: string;
}

// Helper function to build email HTML with dynamic content support
interface EmailDataWithDynamic extends EmailData {
  dynamicContent?: DynamicEmailContent | null;
}

function buildEmailHtmlDynamic(
  templateData: any,
  language: string,
  trans: typeof emailTranslations['en'],
  data: EmailDataWithDynamic
): string {
  const { totalScore, maxScore, resultTitle, resultDescription, insights, 
          opennessScore, opennessMaxScore, opennessTitle, opennessDescription, email,
          dynamicContent } = data;
  
  // Use dynamic content from quiz_result_levels if available
  const finalResultTitle = dynamicContent?.resultTitle || resultTitle;
  const finalResultDescription = dynamicContent?.resultDescription || resultDescription;
  const finalInsights = dynamicContent?.insights?.length ? dynamicContent.insights : insights;
  const finalCtaTitle = dynamicContent?.ctaTitle || trans.wantToImprove;
  const finalCtaDescription = dynamicContent?.ctaDescription || trans.ctaDescription;
  const finalCtaButtonText = dynamicContent?.ctaButtonText || trans.visitSparkly;
  const finalCtaUrl = dynamicContent?.ctaUrl || 'https://sparkly.hr';
  const resultEmoji = dynamicContent?.emoji || '🎯';
  
  const logoUrl = "https://sparkly.hr/wp-content/uploads/2025/06/sparkly-logo.png";
  const safeResultTitle = escapeHtml(finalResultTitle);
  const safeResultDescription = escapeHtml(finalResultDescription);
  const safeInsights = finalInsights.map(insight => escapeHtml(String(insight)));
  const safeOpennessTitle = opennessTitle ? escapeHtml(opennessTitle) : '';
  const safeOpennessDescription = opennessDescription ? escapeHtml(opennessDescription) : '';
  const safeCtaTitle = escapeHtml(finalCtaTitle);
  const safeCtaDescription = escapeHtml(finalCtaDescription);
  const safeCtaButtonText = escapeHtml(finalCtaButtonText);
  
  // Build insights list with styled bullets
  const insightsHtml = safeInsights.length > 0 ? safeInsights.map(insight => `
    <tr>
      <td style="padding: 8px 0; vertical-align: top;">
        <span style="display: inline-block; width: 8px; height: 8px; background: linear-gradient(135deg, #6d28d9, #a855f7); border-radius: 50%; margin-right: 12px; margin-top: 6px;"></span>
      </td>
      <td style="padding: 8px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">${insight}</td>
    </tr>
  `).join('') : '';

  // Open-mindedness section (only if score is provided)
  const opennessSection = opennessScore !== undefined && opennessScore !== null ? `
    <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); border-radius: 16px; padding: 28px; margin: 28px 0; color: white;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td>
            <h3 style="font-size: 18px; margin: 0 0 16px 0; font-weight: 600; color: white;">🧠 ${escapeHtml(trans.leadershipOpenMindedness)}</h3>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 16px;">
            <span style="font-size: 42px; font-weight: bold; color: white;">${opennessScore}</span>
            <span style="font-size: 18px; opacity: 0.9; margin-left: 4px; color: rgba(255,255,255,0.9);">/ ${opennessMaxScore}</span>
          </td>
        </tr>
        ${safeOpennessTitle ? `<tr><td><p style="font-size: 18px; font-weight: 600; margin: 0 0 8px 0; color: white;">${safeOpennessTitle}</p></td></tr>` : ''}
        ${safeOpennessDescription ? `<tr><td><p style="font-size: 14px; margin: 0; color: rgba(255,255,255,0.9); line-height: 1.6;">${safeOpennessDescription}</p></td></tr>` : ''}
      </table>
    </div>
  ` : '';

  // CTA section (only if there's a title or description)
  const ctaSection = (finalCtaTitle || finalCtaDescription) ? `
    <div style="background: linear-gradient(135deg, #f3e8ff, #ede9fe); border-radius: 16px; padding: 32px; margin-top: 28px; text-align: center; border: 1px solid #e9d5ff;">
      ${safeCtaTitle ? `<h3 style="color: #6d28d9; font-size: 20px; margin: 0 0 12px 0; font-weight: 600;">${safeCtaTitle}</h3>` : ''}
      ${safeCtaDescription ? `<p style="color: #7c3aed; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">${safeCtaDescription}</p>` : ''}
      <a href="${finalCtaUrl}" style="display: inline-block; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">${safeCtaButtonText}</a>
    </div>
  ` : `
    <div style="text-align: center; margin-top: 28px;">
      <a href="${finalCtaUrl}" style="display: inline-block; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">${safeCtaButtonText}</a>
    </div>
  `;

  // Main email template with modern design
  return `
    <!DOCTYPE html>
    <html lang="${language}">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${safeResultTitle}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8f4f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8f4f0; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background: white; border-radius: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #6d28d9, #a855f7); padding: 40px 40px 32px 40px; text-align: center;">
                  <a href="https://sparkly.hr" target="_blank">
                    <img src="${logoUrl}" alt="Sparkly.hr" style="height: 44px; margin-bottom: 24px;" />
                  </a>
                  <h1 style="color: white; font-size: 26px; margin: 0; font-weight: 700;">${escapeHtml(trans.yourResults)}</h1>
                </td>
              </tr>
              
              <!-- Score -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="background: linear-gradient(135deg, #faf5ff, #f3e8ff); border-radius: 16px; padding: 32px; margin-top: -20px; text-align: center; border: 2px solid #e9d5ff;">
                    <div style="font-size: 56px; font-weight: 800; background: linear-gradient(135deg, #6d28d9, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${totalScore}</div>
                    <div style="color: #7c3aed; font-size: 16px; font-weight: 500;">${trans.outOf} ${maxScore} ${trans.points}</div>
                  </div>
                </td>
              </tr>
              
              <!-- Result Title & Description -->
              <tr>
                <td style="padding: 32px 40px 0 40px;">
                  <h2 style="color: #1f2937; font-size: 24px; margin: 0 0 16px 0; font-weight: 700;">
                    <span style="margin-right: 8px;">${resultEmoji}</span>${safeResultTitle}
                  </h2>
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.7; margin: 0;">${safeResultDescription}</p>
                </td>
              </tr>
              
              ${opennessSection ? `<tr><td style="padding: 0 40px;">${opennessSection}</td></tr>` : ''}
              
              <!-- Insights -->
              ${insightsHtml ? `
              <tr>
                <td style="padding: 28px 40px 0 40px;">
                  <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0; font-weight: 600;">${escapeHtml(trans.keyInsights)}</h3>
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    ${insightsHtml}
                  </table>
                </td>
              </tr>
              ` : ''}
              
              <!-- CTA -->
              <tr>
                <td style="padding: 0 40px 40px 40px;">
                  ${ctaSection}
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background: #faf5ff; padding: 24px 40px; text-align: center; border-top: 1px solid #e9d5ff;">
                  <a href="https://sparkly.hr" target="_blank">
                    <img src="${logoUrl}" alt="Sparkly.hr" style="height: 28px; margin-bottom: 8px; opacity: 0.8;" />
                  </a>
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2025 Sparkly.hr</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-quiz-results function called (SMTP mode)");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const emailConfig = await getEmailConfig();
    
    // Handle check_connection action
    if (body.action === "check_connection") {
      console.log("Checking SMTP connection...");
      
      if (!emailConfig.smtpHost || !emailConfig.smtpUsername || !emailConfig.smtpPassword) {
        return new Response(
          JSON.stringify({ 
            connected: false, 
            error: "SMTP not configured. Please set SMTP host, username, and password.",
            config: {
              hasHost: !!emailConfig.smtpHost,
              hasUsername: !!emailConfig.smtpUsername,
              hasPassword: !!emailConfig.smtpPassword,
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      const senderDomain = emailConfig.senderEmail.split('@')[1] || '';
      
      // DNS record validation results with detailed info
      interface SpfValidation {
        valid: boolean;
        record: string | null;
        allRecords: string[];
        inUse: boolean;
        analysis: {
          hasValidSyntax: boolean;
          includes: string[];
          policy: string | null;
          isStrict: boolean;
        } | null;
      }
      
      interface DkimValidation {
        valid: boolean;
        configured: boolean;
        inUse: boolean;
        selector: string | null;
        record: string | null;
        allRecords: string[];
        analysis: {
          hasValidSyntax: boolean;
          keyType: string | null;
          hasPublicKey: boolean;
        } | null;
      }
      
      interface DmarcValidation {
        valid: boolean;
        record: string | null;
        allRecords: string[];
        inUse: boolean;
        analysis: {
          hasValidSyntax: boolean;
          policy: string | null;
          subdomainPolicy: string | null;
          reportEmail: string | null;
          percentage: number | null;
          isStrict: boolean;
        } | null;
      }
      
      interface DnsValidation {
        spf: SpfValidation;
        dkim: DkimValidation;
        dmarc: DmarcValidation;
        domain: string;
      }
      
      const dnsValidation: DnsValidation = {
        spf: { valid: false, record: null, allRecords: [], inUse: true, analysis: null },
        dkim: { 
          valid: false, 
          configured: !!emailConfig.dkimPrivateKey,
          inUse: !!emailConfig.dkimPrivateKey && !!emailConfig.dkimSelector,
          selector: emailConfig.dkimSelector || null,
          record: null,
          allRecords: [],
          analysis: null
        },
        dmarc: { valid: false, record: null, allRecords: [], inUse: true, analysis: null },
        domain: senderDomain,
      };
      
      // Check SPF record via DNS
      if (senderDomain) {
        try {
          console.log(`Checking SPF record for ${senderDomain}...`);
          const txtRecords = await Deno.resolveDns(senderDomain, "TXT");
          const allTxtRecords = txtRecords.flat();
          const spfRecords = allTxtRecords.filter((r: string) => r.startsWith("v=spf1"));
          dnsValidation.spf.allRecords = spfRecords;
          
          if (spfRecords.length > 0) {
            // Use the first valid SPF record
            const spfRecord = spfRecords[0];
            dnsValidation.spf.record = spfRecord;
            dnsValidation.spf.valid = true;
            
            // Parse SPF record for analysis
            const includes = spfRecord.match(/include:([^\s]+)/g)?.map((m: string) => m.replace('include:', '')) || [];
            const policyMatch = spfRecord.match(/([~\-+?])all/);
            const policy = policyMatch ? policyMatch[0] : null;
            
            dnsValidation.spf.analysis = {
              hasValidSyntax: spfRecord.startsWith("v=spf1"),
              includes,
              policy,
              isStrict: policy === "-all" || policy === "~all",
            };
            
            console.log("SPF record found:", spfRecord);
            if (spfRecords.length > 1) {
              console.log(`Warning: Found ${spfRecords.length} SPF records (should only have 1)`);
            }
          } else {
            console.log("No SPF record found for domain");
          }
        } catch (e: any) {
          console.log("SPF lookup failed:", e.message);
        }
        
        // Check DMARC record via DNS
        try {
          console.log(`Checking DMARC record for _dmarc.${senderDomain}...`);
          const dmarcRecords = await Deno.resolveDns(`_dmarc.${senderDomain}`, "TXT");
          const allDmarcRecords = dmarcRecords.flat().filter((r: string) => r.startsWith("v=DMARC1"));
          dnsValidation.dmarc.allRecords = allDmarcRecords;
          
          if (allDmarcRecords.length > 0) {
            const dmarcRecord = allDmarcRecords[0];
            dnsValidation.dmarc.record = dmarcRecord;
            dnsValidation.dmarc.valid = true;
            
            // Parse DMARC record for analysis
            const policyMatch = dmarcRecord.match(/p=([^;]+)/);
            const subdomainPolicyMatch = dmarcRecord.match(/sp=([^;]+)/);
            const ruaMatch = dmarcRecord.match(/rua=mailto:([^;,\s]+)/);
            const pctMatch = dmarcRecord.match(/pct=(\d+)/);
            const policy = policyMatch ? policyMatch[1].trim() : null;
            
            dnsValidation.dmarc.analysis = {
              hasValidSyntax: dmarcRecord.startsWith("v=DMARC1"),
              policy,
              subdomainPolicy: subdomainPolicyMatch ? subdomainPolicyMatch[1].trim() : null,
              reportEmail: ruaMatch ? ruaMatch[1] : null,
              percentage: pctMatch ? parseInt(pctMatch[1], 10) : 100,
              isStrict: policy === "reject" || policy === "quarantine",
            };
            
            console.log("DMARC record found:", dmarcRecord);
            if (allDmarcRecords.length > 1) {
              console.log(`Warning: Found ${allDmarcRecords.length} DMARC records (should only have 1)`);
            }
          } else {
            console.log("No DMARC record found for domain");
          }
        } catch (e: any) {
          console.log("DMARC lookup failed:", e.message);
        }
        
        // Check DKIM record via DNS if selector is configured
        if (emailConfig.dkimSelector && emailConfig.dkimDomain) {
          try {
            const dkimHost = `${emailConfig.dkimSelector}._domainkey.${emailConfig.dkimDomain}`;
            console.log(`Checking DKIM record at ${dkimHost}...`);
            const dkimRecords = await Deno.resolveDns(dkimHost, "TXT");
            const allDkimRecords = dkimRecords.flat();
            const validDkimRecords = allDkimRecords.filter((r: string) => r.includes("v=DKIM1") || r.includes("k=rsa") || r.includes("p="));
            dnsValidation.dkim.allRecords = validDkimRecords;
            
            if (validDkimRecords.length > 0) {
              const dkimRecord = validDkimRecords[0];
              dnsValidation.dkim.record = dkimRecord;
              dnsValidation.dkim.valid = true;
              
              // Parse DKIM record for analysis
              const keyTypeMatch = dkimRecord.match(/k=([^;]+)/);
              const hasPublicKey = dkimRecord.includes("p=") && !dkimRecord.includes("p=;") && !dkimRecord.includes("p= ");
              
              dnsValidation.dkim.analysis = {
                hasValidSyntax: dkimRecord.includes("v=DKIM1") || (dkimRecord.includes("k=") && dkimRecord.includes("p=")),
                keyType: keyTypeMatch ? keyTypeMatch[1].trim() : "rsa",
                hasPublicKey,
              };
              
              console.log("DKIM DNS record found");
            } else {
              console.log("DKIM DNS record not found or invalid");
            }
          } catch (e: any) {
            console.log("DKIM DNS lookup failed:", e.message);
          }
        }
      }
      
      // Test SMTP connectivity - use TLS for port 465, regular TCP for others
      try {
        const port = parseInt(emailConfig.smtpPort, 10) || 587;
        const useImplicitTls = port === 465;
        console.log(`Testing ${useImplicitTls ? "TLS" : "TCP"} connection to ${emailConfig.smtpHost}:${port}...`);
        
        let conn: Deno.Conn;
        
        if (useImplicitTls) {
          conn = await Deno.connectTls({
            hostname: emailConfig.smtpHost,
            port: port,
          });
        } else {
          conn = await Deno.connect({
            hostname: emailConfig.smtpHost,
            port: port,
          });
        }
        
        const buffer = new Uint8Array(512);
        const readPromise = conn.read(buffer);
        const timeoutPromise = new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error("Connection timeout")), 10000)
        );
        
        const bytesRead = await Promise.race([readPromise, timeoutPromise]) as number | null;
        conn.close();
        
        if (bytesRead && bytesRead > 0) {
          const response = new TextDecoder().decode(buffer.subarray(0, bytesRead));
          console.log("SMTP greeting received:", response.substring(0, 100));
          
          if (response.startsWith("220")) {
            console.log("SMTP connection successful");
            return new Response(
              JSON.stringify({ 
                connected: true, 
                provider: "SMTP",
                config: {
                  host: emailConfig.smtpHost,
                  port: emailConfig.smtpPort,
                  tls: emailConfig.smtpTls,
                  senderEmail: emailConfig.senderEmail,
                  senderName: emailConfig.senderName,
                },
                domains: [{
                  name: senderDomain || 'unknown',
                  status: 'configured',
                  region: 'smtp'
                }],
                dnsValidation,
              }),
              { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          } else {
            throw new Error(`Unexpected SMTP response: ${response.substring(0, 50)}`);
          }
        } else {
          throw new Error("No response from SMTP server");
        }
      } catch (connError: any) {
        console.error("SMTP connection check failed:", connError);
        return new Response(
          JSON.stringify({ 
            connected: false, 
            error: connError.message,
            dnsValidation, // Still return DNS validation even if connection failed
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Handle DNS-only validation (without SMTP connection check)
    if (body.action === "check_dns") {
      console.log("Checking DNS records only...");
      
      const senderDomain = emailConfig.senderEmail.split('@')[1] || '';
      
      // Same DNS validation structure as check_connection
      interface SpfValidation {
        valid: boolean;
        record: string | null;
        allRecords: string[];
        inUse: boolean;
        analysis: {
          hasValidSyntax: boolean;
          includes: string[];
          policy: string | null;
          isStrict: boolean;
        } | null;
      }
      
      interface DkimValidation {
        valid: boolean;
        configured: boolean;
        inUse: boolean;
        selector: string | null;
        record: string | null;
        allRecords: string[];
        analysis: {
          hasValidSyntax: boolean;
          keyType: string | null;
          hasPublicKey: boolean;
        } | null;
      }
      
      interface DmarcValidation {
        valid: boolean;
        record: string | null;
        allRecords: string[];
        inUse: boolean;
        analysis: {
          hasValidSyntax: boolean;
          policy: string | null;
          subdomainPolicy: string | null;
          reportEmail: string | null;
          percentage: number | null;
          isStrict: boolean;
        } | null;
      }
      
      interface DnsValidation {
        spf: SpfValidation;
        dkim: DkimValidation;
        dmarc: DmarcValidation;
        domain: string;
        checkedAt: string;
      }
      
      const dnsValidation: DnsValidation = {
        spf: { valid: false, record: null, allRecords: [], inUse: true, analysis: null },
        dkim: { 
          valid: false, 
          configured: !!emailConfig.dkimPrivateKey,
          inUse: !!emailConfig.dkimPrivateKey && !!emailConfig.dkimSelector,
          selector: emailConfig.dkimSelector || null,
          record: null,
          allRecords: [],
          analysis: null
        },
        dmarc: { valid: false, record: null, allRecords: [], inUse: true, analysis: null },
        domain: senderDomain,
        checkedAt: new Date().toISOString(),
      };
      
      if (senderDomain) {
        // Check SPF
        try {
          console.log(`Checking SPF record for ${senderDomain}...`);
          const txtRecords = await Deno.resolveDns(senderDomain, "TXT");
          const allTxtRecords = txtRecords.flat();
          const spfRecords = allTxtRecords.filter((r: string) => r.startsWith("v=spf1"));
          dnsValidation.spf.allRecords = spfRecords;
          
          if (spfRecords.length > 0) {
            const spfRecord = spfRecords[0];
            dnsValidation.spf.record = spfRecord;
            dnsValidation.spf.valid = true;
            
            const includes = spfRecord.match(/include:([^\s]+)/g)?.map((m: string) => m.replace('include:', '')) || [];
            const policyMatch = spfRecord.match(/([~\-+?])all/);
            const policy = policyMatch ? policyMatch[0] : null;
            
            dnsValidation.spf.analysis = {
              hasValidSyntax: spfRecord.startsWith("v=spf1"),
              includes,
              policy,
              isStrict: policy === "-all" || policy === "~all",
            };
            console.log("SPF record found:", spfRecord);
          }
        } catch (e: any) {
          console.log("SPF lookup failed:", e.message);
        }
        
        // Check DMARC
        try {
          console.log(`Checking DMARC record for _dmarc.${senderDomain}...`);
          const dmarcRecords = await Deno.resolveDns(`_dmarc.${senderDomain}`, "TXT");
          const allDmarcRecords = dmarcRecords.flat().filter((r: string) => r.startsWith("v=DMARC1"));
          dnsValidation.dmarc.allRecords = allDmarcRecords;
          
          if (allDmarcRecords.length > 0) {
            const dmarcRecord = allDmarcRecords[0];
            dnsValidation.dmarc.record = dmarcRecord;
            dnsValidation.dmarc.valid = true;
            
            const policyMatch = dmarcRecord.match(/p=([^;]+)/);
            const subdomainPolicyMatch = dmarcRecord.match(/sp=([^;]+)/);
            const ruaMatch = dmarcRecord.match(/rua=mailto:([^;,\s]+)/);
            const pctMatch = dmarcRecord.match(/pct=(\d+)/);
            const policy = policyMatch ? policyMatch[1].trim() : null;
            
            dnsValidation.dmarc.analysis = {
              hasValidSyntax: dmarcRecord.startsWith("v=DMARC1"),
              policy,
              subdomainPolicy: subdomainPolicyMatch ? subdomainPolicyMatch[1].trim() : null,
              reportEmail: ruaMatch ? ruaMatch[1] : null,
              percentage: pctMatch ? parseInt(pctMatch[1], 10) : 100,
              isStrict: policy === "reject" || policy === "quarantine",
            };
            console.log("DMARC record found:", dmarcRecord);
          }
        } catch (e: any) {
          console.log("DMARC lookup failed:", e.message);
        }
        
        // Check DKIM
        if (emailConfig.dkimSelector && emailConfig.dkimDomain) {
          try {
            const dkimHost = `${emailConfig.dkimSelector}._domainkey.${emailConfig.dkimDomain}`;
            console.log(`Checking DKIM record at ${dkimHost}...`);
            const dkimRecords = await Deno.resolveDns(dkimHost, "TXT");
            const allDkimRecords = dkimRecords.flat();
            const validDkimRecords = allDkimRecords.filter((r: string) => r.includes("v=DKIM1") || r.includes("k=rsa") || r.includes("p="));
            dnsValidation.dkim.allRecords = validDkimRecords;
            
            if (validDkimRecords.length > 0) {
              const dkimRecord = validDkimRecords[0];
              dnsValidation.dkim.record = dkimRecord;
              dnsValidation.dkim.valid = true;
              
              const keyTypeMatch = dkimRecord.match(/k=([^;]+)/);
              const hasPublicKey = dkimRecord.includes("p=") && !dkimRecord.includes("p=;") && !dkimRecord.includes("p= ");
              
              dnsValidation.dkim.analysis = {
                hasValidSyntax: dkimRecord.includes("v=DKIM1") || (dkimRecord.includes("k=") && dkimRecord.includes("p=")),
                keyType: keyTypeMatch ? keyTypeMatch[1].trim() : "rsa",
                hasPublicKey,
              };
              console.log("DKIM DNS record found");
            }
          } catch (e: any) {
            console.log("DKIM DNS lookup failed:", e.message);
          }
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          dnsValidation,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Handle DKIM key generation
    if (body.action === "generate_dkim") {
      console.log("Generating DKIM keys...");
      try {
        const selector = `sparkly${Date.now().toString(36)}`;
        
        const keyPair = await crypto.subtle.generateKey(
          {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
          },
          true,
          ["sign", "verify"]
        );
        
        const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
        const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));
        const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyBase64.match(/.{1,64}/g)?.join("\n")}\n-----END PRIVATE KEY-----`;
        
        const publicKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
        const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));
        
        console.log("DKIM keys generated successfully");
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            selector,
            privateKey: privateKeyPem,
            publicKey: publicKeyBase64,
            dnsRecord: `v=DKIM1; k=rsa; p=${publicKeyBase64}`,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (dkimError: any) {
        console.error("DKIM generation failed:", dkimError);
        return new Response(
          JSON.stringify({ success: false, error: dkimError.message }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
    
    // Handle test_email action
    if (body.action === "test_email") {
      console.log("Sending test email to:", body.testEmail, "type:", body.emailType);
      
      if (!emailConfig.smtpHost) {
        return new Response(
          JSON.stringify({ success: false, error: "SMTP not configured" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // SECURITY: Restrict test emails to admin users or the configured sender email only
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get list of allowed test email recipients: sender email + all admin emails
      const allowedEmails = new Set<string>();
      
      // Add the configured sender email
      if (emailConfig.senderEmail) {
        allowedEmails.add(emailConfig.senderEmail.toLowerCase().trim());
      }
      
      // Fetch admin emails from profiles + user_roles
      const { data: adminProfiles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminProfiles && adminProfiles.length > 0) {
        const adminUserIds = adminProfiles.map((r: { user_id: string }) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("user_id", adminUserIds);

        if (profiles) {
          profiles.forEach((p: { email: string | null }) => {
            if (p.email) {
              allowedEmails.add(p.email.toLowerCase().trim());
            }
          });
        }
      }

      const recipientEmail = (body.testEmail || "").toLowerCase().trim();
      if (!allowedEmails.has(recipientEmail)) {
        console.warn("Test email blocked - recipient not allowed:", body.testEmail, "Allowed:", Array.from(allowedEmails));
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Test emails can only be sent to admin accounts or the sender email (${emailConfig.senderEmail}). Current recipient: ${body.testEmail}` 
          }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("Test email recipient allowed:", body.testEmail);

      const emailType = body.emailType || "simple";
      let subject = "Sparkly Email Configuration Test";
      let html = "";
      
      if (emailType === "quiz_result") {
        subject = "Test: Your Quiz Results";
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8f9fa;">
            <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #1f2937; font-size: 24px; margin: 0;">🎯 Test Quiz Results</h1>
              </div>
              <div style="background: linear-gradient(135deg, #10b981, #059669); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <p style="color: white; font-size: 18px; margin: 0 0 8px 0;">Your Score</p>
                <p style="color: white; font-size: 36px; font-weight: bold; margin: 0;">85 / 100</p>
              </div>
              <h3 style="color: #1f2937; margin-bottom: 12px;">Key Insights:</h3>
              <ul style="color: #6b7280; line-height: 1.8;">
                <li>This is a test insight about your results</li>
                <li>Your team shows strong collaboration skills</li>
                <li>Consider focusing on communication improvement</li>
              </ul>
              <div style="text-align: center; margin-top: 30px;">
                <a href="https://sparkly.hr" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Continue to Sparkly.hr</a>
              </div>
            </div>
          </div>
        `;
      } else if (emailType === "notification") {
        subject = "Test: New Quiz Submission Notification";
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8f9fa;">
            <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #1f2937; font-size: 24px; margin: 0;">📬 New Quiz Submission</h1>
              </div>
              <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0;"><strong>User Email:</strong> test@example.com</p>
                <p style="margin: 0 0 8px 0;"><strong>Score:</strong> 85 / 100</p>
                <p style="margin: 0 0 8px 0;"><strong>Result Category:</strong> High Performer</p>
                <p style="margin: 0;"><strong>Language:</strong> EN</p>
              </div>
              <p style="color: #6b7280; text-align: center;">This is a test admin notification email.</p>
            </div>
          </div>
        `;
      } else {
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1a1a1a; margin: 0;">✅ SMTP Email Configuration Working</h1>
            </div>
            <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <p style="color: #4a4a4a; margin: 0 0 12px 0; line-height: 1.6;">
                This is a test email from your Sparkly application via SMTP. If you received this, your email configuration is working correctly.
              </p>
              <p style="color: #6b7280; margin: 0; font-size: 13px;">
                <strong>SMTP Host:</strong> ${emailConfig.smtpHost}:${emailConfig.smtpPort}<br>
                <strong>Sender:</strong> ${emailConfig.senderName} &lt;${emailConfig.senderEmail}&gt;<br>
                <strong>TLS:</strong> ${emailConfig.smtpTls ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div style="text-align: center; color: #888; font-size: 12px;">
              <p>Sent via SMTP from ${emailConfig.senderName}</p>
              <p>Timestamp: ${new Date().toISOString()}</p>
            </div>
          </div>
        `;
      }
      
      const fromAddress = `${emailConfig.senderName} <${emailConfig.senderEmail}>`;
      console.log("Sending test email from:", fromAddress);
      
      const testResult = await sendEmailWithRetry(emailConfig, {
        from: fromAddress,
        to: [body.testEmail],
        subject,
        html,
        replyTo: emailConfig.replyToEmail || undefined,
      });
      
      if (!testResult.success) {
        console.error("Test email failed:", testResult.error);
        return new Response(
          JSON.stringify({ success: false, error: testResult.error }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      console.log("Test email sent successfully");
      return new Response(
        JSON.stringify({ success: true, id: testResult.messageId }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Rate limiting check for regular email sending
    const clientIP = getClientIP(req);
    console.log("Client IP:", clientIP);
    
    const rateLimitResult = checkRateLimit(clientIP);
    
    if (!rateLimitResult.allowed) {
      const resetDate = new Date(rateLimitResult.resetTime);
      console.log(`Rate limit exceeded for IP: ${clientIP}. Reset at: ${resetDate.toISOString()}`);
      
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later.", resetTime: rateLimitResult.resetTime }),
        { status: 429, headers: { "Content-Type": "application/json", "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": rateLimitResult.resetTime.toString(), ...corsHeaders } }
      );
    }

    const { 
      email, 
      totalScore, 
      maxScore, 
      resultTitle, 
      resultDescription, 
      insights, 
      language = 'en', 
      answers, 
      opennessScore, 
      opennessMaxScore = 4,
      opennessTitle = '',
      opennessDescription = '',
      quizId,
      isTest = false,
      templateOverride 
    }: QuizResultsRequest & { isTest?: boolean } = body;

    console.log("Processing quiz results for:", email);
    console.log("Score:", totalScore, "/", maxScore);
    console.log("Quiz ID:", quizId);
    console.log("Language:", language);

    const trans = emailTranslations[language] || emailTranslations.en;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // PRIORITY 1: Store lead in database IMMEDIATELY (fast operation)
    let quizLeadId: string | null = null;

    if (!isTest) {
      console.log("Storing lead in database (priority 1)...");
      const { data: insertedLead, error: insertError } = await supabase.from("quiz_leads").insert({
        email,
        score: totalScore,
        total_questions: maxScore,
        result_category: resultTitle,
        answers: answers || null,
        openness_score: opennessScore ?? null,
        language: language,
        quiz_id: quizId || null,
      }).select("id").single();

      if (insertError) {
        console.error("Error saving lead to database:", insertError);
        // Still continue - email might work
      } else {
        quizLeadId = insertedLead?.id || null;
        console.log("Lead stored successfully with ID:", quizLeadId);
      }
    }

    // For test emails, wait for the email to complete
    if (isTest) {
      // SECURITY: Restrict test emails to admin users or the configured sender email only
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get list of allowed test email recipients: sender email + all admin emails
      const allowedEmails = new Set<string>();
      
      // Add the configured sender email
      if (emailConfig.senderEmail) {
        allowedEmails.add(emailConfig.senderEmail.toLowerCase().trim());
      }
      
      // Fetch admin emails from profiles + user_roles
      const { data: adminProfiles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminProfiles && adminProfiles.length > 0) {
        const adminUserIds = adminProfiles.map((r: { user_id: string }) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("user_id", adminUserIds);

        if (profiles) {
          profiles.forEach((p: { email: string | null }) => {
            if (p.email) {
              allowedEmails.add(p.email.toLowerCase().trim());
            }
          });
        }
      }

      const recipientEmail = email.toLowerCase().trim();
      if (!allowedEmails.has(recipientEmail)) {
        console.warn("Test email blocked - recipient not allowed:", email, "Allowed:", Array.from(allowedEmails));
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Test emails can only be sent to admin accounts or the sender email (${emailConfig.senderEmail}). Current recipient: ${email}` 
          }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("Test email recipient allowed:", email);

      // Original synchronous behavior for test emails
      if (!isEmailServiceConfigured(emailConfig)) {
        console.error("Email service not configured");
        return new Response(
          JSON.stringify({ error: "Email service not configured" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Fetch email template configuration
      let templateData = null;
      if (quizId) {
        const { data: quizTemplate } = await supabase
          .from("email_templates")
          .select("*")
          .eq("template_type", "quiz_results")
          .eq("quiz_id", quizId)
          .eq("is_live", true)
          .limit(1)
          .maybeSingle();
        
        if (quizTemplate) {
          templateData = quizTemplate;
        }
      }
      
      if (!templateData) {
        const { data: globalTemplate } = await supabase
          .from("email_templates")
          .select("*")
          .eq("template_type", "quiz_results")
          .is("quiz_id", null)
          .eq("is_live", true)
          .limit(1)
          .maybeSingle();
        
        templateData = globalTemplate;
      }

      // Global email config from app_settings takes priority for sender identity
      const senderName = emailConfig.senderName;
      const senderEmail = emailConfig.senderEmail;
      const templateSubjects = templateData?.subjects as Record<string, string> || {};
      const emailSubject = templateOverride?.subject?.trim() || templateSubjects[language] || trans.subject;

      // Fetch dynamic content for 50plus quiz (pass CTA template ID from email template)
      const ctaTemplateId = templateData?.cta_template_id as string | null;
      let dynamicContent: DynamicEmailContent | null = null;
      if (quizId) {
        dynamicContent = await fetchDynamicEmailContent(supabase, quizId, totalScore, language, ctaTemplateId);
      }

      const emailHtml = buildEmailHtmlDynamic(templateData, language, trans, {
        totalScore, maxScore, resultTitle, resultDescription, insights,
        opennessScore, opennessMaxScore, opennessTitle, opennessDescription, email,
        dynamicContent
      });

      const finalResultTitle = dynamicContent?.resultTitle || resultTitle;
      const userEmailSubject = `${emailSubject}: ${escapeHtml(finalResultTitle)}`;
      const userEmailResponse = await sendEmailWithRetry(emailConfig, {
        from: `${senderName} <${senderEmail}>`,
        to: [email],
        subject: userEmailSubject,
        html: emailHtml,
        replyTo: emailConfig.replyToEmail || undefined,
      });

      return new Response(JSON.stringify({ success: true, isTest: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // PRIORITY 2: Return success immediately to the user
    // Email sending will happen in background
    console.log("Returning success to user, starting background email task...");

    // Define the background email task - now queues emails instead of sending directly
    const queueEmailsInBackground = async () => {
      console.log("Background task: Queuing emails...");
      
      try {
        // Fetch email template configuration
        let templateData = null;
        if (quizId) {
          const { data: quizTemplate } = await supabase
            .from("email_templates")
            .select("*")
            .eq("template_type", "quiz_results")
            .eq("quiz_id", quizId)
            .eq("is_live", true)
            .limit(1)
            .maybeSingle();
          
          if (quizTemplate) {
            templateData = quizTemplate;
            console.log("Background task: Using quiz-specific email template");
          }
        }
        
        if (!templateData) {
          const { data: globalTemplate } = await supabase
            .from("email_templates")
            .select("*")
            .eq("template_type", "quiz_results")
            .is("quiz_id", null)
            .eq("is_live", true)
            .limit(1)
            .maybeSingle();
          
          templateData = globalTemplate;
        }

        // Global email config from app_settings takes priority for sender identity
        const senderName = emailConfig.senderName;
        const senderEmail = emailConfig.senderEmail;
        const templateSubjects = templateData?.subjects as Record<string, string> || {};
        const emailSubject = templateOverride?.subject?.trim() || templateSubjects[language] || trans.subject;

        console.log("Background task: Using email config:", { senderName, senderEmail, subject: emailSubject });

        // Fetch dynamic content for all quizzes (pass CTA template ID from email template)
        const ctaTemplateId = templateData?.cta_template_id as string | null;
        let dynamicContent: DynamicEmailContent | null = null;
        if (quizId) {
          dynamicContent = await fetchDynamicEmailContent(supabase, quizId, totalScore, language, ctaTemplateId);
        }

        const emailHtml = buildEmailHtmlDynamic(templateData, language, trans, {
          totalScore, maxScore, resultTitle, resultDescription, insights,
          opennessScore, opennessMaxScore, opennessTitle, opennessDescription, email,
          dynamicContent
        });

        // Check for duplicate user email before queuing
        const { data: existingUserEmail } = await supabase
          .from("email_queue")
          .select("id")
          .eq("quiz_lead_id", quizLeadId)
          .eq("email_type", "quiz_result_user")
          .in("status", ["pending", "processing", "sent"])
          .limit(1)
          .maybeSingle();

        const { data: existingUserLog } = await supabase
          .from("email_logs")
          .select("id")
          .eq("quiz_lead_id", quizLeadId)
          .eq("email_type", "quiz_result_user")
          .limit(1)
          .maybeSingle();

        // Queue user email only if not already sent/queued
        const finalResultTitle = dynamicContent?.resultTitle || resultTitle;
        const userEmailSubject = `${emailSubject}: ${escapeHtml(finalResultTitle)}`;
        
        if (!existingUserEmail && !existingUserLog) {
          console.log("Background task: Queuing user email to:", email);
          const { error: userQueueError } = await supabase.from("email_queue").insert({
            recipient_email: email,
            sender_email: senderEmail,
            sender_name: senderName,
            subject: userEmailSubject,
            html_body: emailHtml,
            email_type: "quiz_result_user",
            quiz_lead_id: quizLeadId,
            quiz_id: quizId || null,
            language: language,
            reply_to_email: emailConfig.replyToEmail || null,
          });

          if (userQueueError) {
            console.error("Background task: Error queuing user email:", userQueueError);
          } else {
            console.log("Background task: User email queued successfully");
          }
        } else {
          console.log("Background task: User email already queued/sent for lead:", quizLeadId);
        }

        // Queue admin notification email
        const adminTrans = emailTranslations.en;
        const logoUrl = "https://sparkly.hr/wp-content/uploads/2025/06/sparkly-logo.png";
        const safeEmail = escapeHtml(email);
        // Use dynamic result title/insights for admin email too
        const adminResultTitle = dynamicContent?.resultTitle || resultTitle;
        const adminInsights = dynamicContent?.insights?.length ? dynamicContent.insights : insights;
        const safeResultTitleAdmin = escapeHtml(adminResultTitle);
        const safeOpennessTitle = opennessTitle ? escapeHtml(opennessTitle) : '';
        const safeInsightsAdmin = adminInsights.map(insight => escapeHtml(String(insight)));
        const insightsList = safeInsightsAdmin.map((insight, i) => `<li style="margin-bottom: 8px;">${i + 1}. ${insight}</li>`).join("");

        const adminEmailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              <div style="text-align: center; margin-bottom: 30px;">
                <img src="${logoUrl}" alt="Sparkly.hr" style="height: 40px; margin-bottom: 16px;" />
                <h1 style="color: #1f2937; font-size: 24px; margin: 0;">${adminTrans.newQuizSubmission}</h1>
              </div>
              
              <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0;"><strong>${adminTrans.userEmail}:</strong> ${safeEmail}</p>
                <p style="margin: 0 0 8px 0;"><strong>${adminTrans.score}:</strong> ${totalScore} / ${maxScore}</p>
                <p style="margin: 0 0 8px 0;"><strong>${adminTrans.resultCategory}:</strong> ${safeResultTitleAdmin}</p>
                <p style="margin: 0 0 8px 0;"><strong>${adminTrans.leadershipOpenMindedness}:</strong> ${opennessScore !== undefined && opennessScore !== null ? `${opennessScore} / ${opennessMaxScore}` : 'N/A'}${safeOpennessTitle ? ` - ${safeOpennessTitle}` : ''}</p>
                <p style="margin: 0;"><strong>Language:</strong> ${language.toUpperCase()}</p>
              </div>
              
              <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 12px;">${adminTrans.keyInsights}:</h3>
              <ul style="color: #6b7280; line-height: 1.8; padding-left: 20px; margin-bottom: 20px;">
                ${insightsList}
              </ul>
              
              <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; font-size: 12px;">© 2025 Sparkly.hr</p>
              </div>
            </div>
          </body>
          </html>
        `;

        // Check for duplicate admin email before queuing
        const { data: existingAdminEmail } = await supabase
          .from("email_queue")
          .select("id")
          .eq("quiz_lead_id", quizLeadId)
          .eq("email_type", "quiz_result_admin")
          .in("status", ["pending", "processing", "sent"])
          .limit(1)
          .maybeSingle();

        const { data: existingAdminLog } = await supabase
          .from("email_logs")
          .select("id")
          .eq("quiz_lead_id", quizLeadId)
          .eq("email_type", "quiz_result_admin")
          .limit(1)
          .maybeSingle();

        const adminEmailSubject = `New Quiz Lead: ${safeEmail} - ${safeResultTitleAdmin}`;
        
        if (!existingAdminEmail && !existingAdminLog) {
          console.log("Background task: Queuing admin email to: mikk@sparkly.hr");
          const { error: adminQueueError } = await supabase.from("email_queue").insert({
            recipient_email: "mikk@sparkly.hr",
            sender_email: senderEmail,
            sender_name: `${senderName} Quiz`,
            subject: adminEmailSubject,
            html_body: adminEmailHtml,
            email_type: "quiz_result_admin",
            quiz_lead_id: quizLeadId,
            quiz_id: quizId || null,
            language: language,
            reply_to_email: emailConfig.replyToEmail || null,
          });

          if (adminQueueError) {
            console.error("Background task: Error queuing admin email:", adminQueueError);
          } else {
            console.log("Background task: Admin email queued successfully");
          }
        } else {
          console.log("Background task: Admin email already queued/sent for lead:", quizLeadId);
        }

        console.log("Background task: Email queuing complete");
      } catch (bgError) {
        console.error("Background task: Error queuing emails:", bgError);
      }
    };

    // Start the background task using EdgeRuntime.waitUntil
    // This allows the function to return immediately while emails are queued in background
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(queueEmailsInBackground());
    } else {
      // Fallback: run in background without waiting (fire and forget)
      queueEmailsInBackground();
    }

    // Return success immediately - lead is already stored
    return new Response(JSON.stringify({ success: true, leadId: quizLeadId }), {
      status: 200,
      headers: { "Content-Type": "application/json", "X-RateLimit-Remaining": rateLimitResult.remainingRequests.toString(), "X-RateLimit-Reset": rateLimitResult.resetTime.toString(), ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-quiz-results:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
