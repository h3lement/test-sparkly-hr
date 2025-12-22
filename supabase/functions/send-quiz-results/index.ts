import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

// Create SMTP client
async function createSmtpClient(config: EmailConfigSettings): Promise<SMTPClient | null> {
  if (!config.smtpHost || !config.smtpUsername || !config.smtpPassword) {
    console.error("SMTP not configured - missing host, username, or password");
    return null;
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: config.smtpHost,
        port: parseInt(config.smtpPort, 10) || 587,
        tls: config.smtpTls,
        auth: {
          username: config.smtpUsername,
          password: config.smtpPassword,
        },
      },
    });
    return client;
  } catch (error) {
    console.error("Failed to create SMTP client:", error);
    return null;
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
    console.log(`Email send attempt ${attempt}/${MAX_RETRIES} to: ${emailParams.to.join(", ")}`);
    
    try {
      const client = await createSmtpClient(config);
      if (!client) {
        return { success: false, error: "SMTP not configured", attempts: attempt };
      }

      await client.send({
        from: emailParams.from,
        to: emailParams.to,
        subject: emailParams.subject,
        content: emailParams.html,
        html: emailParams.html,
        ...(emailParams.replyTo ? { replyTo: emailParams.replyTo } : {}),
      });

      await client.close();
      
      console.log(`Email sent successfully on attempt ${attempt}`);
      return { success: true, error: null, attempts: attempt, messageId: `smtp-${Date.now()}` };
    } catch (error: any) {
      lastError = error.message || "Unknown SMTP error";
      console.error(`Email send attempt ${attempt} failed:`, lastError);
      
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
      
      try {
        const client = await createSmtpClient(emailConfig);
        if (client) {
          await client.close();
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
                name: emailConfig.senderEmail.split('@')[1] || 'unknown',
                status: 'configured',
                region: 'smtp'
              }]
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        throw new Error("Failed to create SMTP client");
      } catch (connError: any) {
        console.error("SMTP connection check failed:", connError);
        return new Response(
          JSON.stringify({ connected: false, error: connError.message }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
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

    if (!emailConfig.smtpHost) {
      console.error("SMTP not configured");
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
        console.log("Using quiz-specific email template");
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

    const senderName = templateOverride?.sender_name?.trim() || templateData?.sender_name?.trim() || emailConfig.senderName;
    const senderEmail = templateOverride?.sender_email?.trim() || templateData?.sender_email?.trim() || emailConfig.senderEmail;
    const templateSubjects = templateData?.subjects as Record<string, string> || {};
    const emailSubject = templateOverride?.subject?.trim() || templateSubjects[language] || trans.subject;

    console.log("Using email config:", { senderName, senderEmail, subject: emailSubject });

    let quizLeadId: string | null = null;

    if (!isTest) {
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
      } else {
        quizLeadId = insertedLead?.id || null;
      }
    }

    const safeResultTitle = escapeHtml(resultTitle);
    const safeResultDescription = escapeHtml(resultDescription);
    const safeEmail = escapeHtml(email);
    const safeInsights = insights.map(insight => escapeHtml(insight));
    const insightsList = safeInsights.map((insight, i) => `<li style="margin-bottom: 8px;">${i + 1}. ${insight}</li>`).join("");

    const logoUrl = "https://sparkly.hr/wp-content/uploads/2025/06/sparkly-logo.png";
    const safeOpennessTitle = opennessTitle ? escapeHtml(opennessTitle) : '';
    const safeOpennessDescription = opennessDescription ? escapeHtml(opennessDescription) : '';
    
    const opennessSection = opennessScore !== undefined && opennessScore !== null ? `
      <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); border-radius: 12px; padding: 24px; margin-bottom: 24px; color: white;">
        <h3 style="font-size: 18px; margin: 0 0 12px 0; font-weight: 600;">🧠 ${escapeHtml(trans.leadershipOpenMindedness)}</h3>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="font-size: 32px; font-weight: bold;">${opennessScore}</span>
          <span style="opacity: 0.9;">/ ${opennessMaxScore}</span>
        </div>
        ${safeOpennessTitle ? `<p style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">${safeOpennessTitle}</p>` : ''}
        ${safeOpennessDescription ? `<p style="font-size: 14px; margin: 0; opacity: 0.95; line-height: 1.5;">${safeOpennessDescription}</p>` : ''}
      </div>
    ` : '';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #faf7f5; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="https://sparkly.hr" target="_blank">
              <img src="${logoUrl}" alt="Sparkly.hr" style="height: 48px; margin-bottom: 20px;" />
            </a>
            <h1 style="color: #6d28d9; font-size: 28px; margin: 0;">${escapeHtml(trans.yourResults)}</h1>
          </div>
          
          <div style="text-align: center; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: white; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
            <div style="font-size: 48px; font-weight: bold; margin-bottom: 8px;">${totalScore}</div>
            <div style="opacity: 0.9;">${trans.outOf} ${maxScore} ${trans.points}</div>
          </div>
          
          <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">${safeResultTitle}</h2>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 24px;">${safeResultDescription}</p>
          
          ${opennessSection}
          
          <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">${escapeHtml(trans.keyInsights)}:</h3>
          <ul style="color: #6b7280; line-height: 1.8; padding-left: 20px; margin-bottom: 30px;">
            ${insightsList}
          </ul>
          
          <div style="background: linear-gradient(135deg, #6d28d9, #7c3aed); border-radius: 16px; padding: 32px; margin-top: 30px; text-align: center;">
            <h3 style="color: white; font-size: 20px; margin: 0 0 12px 0; font-weight: 600;">${escapeHtml(trans.wantToImprove)}</h3>
            <p style="color: rgba(255,255,255,0.9); font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">${escapeHtml(trans.ctaDescription)}</p>
            <a href="https://sparkly.hr" style="display: inline-block; background: white; color: #6d28d9; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">${escapeHtml(trans.visitSparkly)}</a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <a href="https://sparkly.hr" target="_blank">
              <img src="${logoUrl}" alt="Sparkly.hr" style="height: 32px; margin-bottom: 10px;" />
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2025 Sparkly.hr</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log("Attempting to send user email to:", email);
    const userEmailSubject = `${emailSubject}: ${safeResultTitle}`;
    const userEmailResponse = await sendEmailWithRetry(emailConfig, {
      from: `${senderName} <${senderEmail}>`,
      to: [email],
      subject: userEmailSubject,
      html: emailHtml,
      replyTo: emailConfig.replyToEmail || undefined,
    });

    console.log("User email response:", JSON.stringify(userEmailResponse));
    
    await supabase.from("email_logs").insert({
      email_type: isTest ? "test" : "quiz_result_user",
      recipient_email: email,
      sender_email: senderEmail,
      sender_name: senderName,
      subject: userEmailSubject,
      status: userEmailResponse.success ? "sent" : "failed",
      resend_id: userEmailResponse.messageId || null,
      error_message: userEmailResponse.error || null,
      language: language,
      quiz_lead_id: quizLeadId,
      resend_attempts: userEmailResponse.attempts - 1,
      last_attempt_at: new Date().toISOString(),
      html_body: emailHtml,
    });
    
    if (!userEmailResponse.success) {
      console.error("User email error after all retries:", userEmailResponse.error);
    }

    if (isTest) {
      console.log("Test email - skipping admin notification");
      return new Response(JSON.stringify({ success: true, isTest: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-RateLimit-Remaining": rateLimitResult.remainingRequests.toString(), "X-RateLimit-Reset": rateLimitResult.resetTime.toString(), ...corsHeaders },
      });
    }

    const adminTrans = emailTranslations.en;
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
            <p style="margin: 0 0 8px 0;"><strong>${adminTrans.resultCategory}:</strong> ${safeResultTitle}</p>
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

    console.log("Attempting to send admin email to: mikk@sparkly.hr");
    const adminEmailSubject = `New Quiz Lead: ${safeEmail} - ${safeResultTitle}`;
    const adminEmailResponse = await sendEmailWithRetry(emailConfig, {
      from: `${senderName} Quiz <${senderEmail}>`,
      to: ["mikk@sparkly.hr"],
      subject: adminEmailSubject,
      html: adminEmailHtml,
      replyTo: emailConfig.replyToEmail || undefined,
    });

    console.log("Admin email response:", JSON.stringify(adminEmailResponse));

    await supabase.from("email_logs").insert({
      email_type: "quiz_result_admin",
      recipient_email: "mikk@sparkly.hr",
      sender_email: senderEmail,
      sender_name: senderName,
      subject: adminEmailSubject,
      status: adminEmailResponse.success ? "sent" : "failed",
      resend_id: adminEmailResponse.messageId || null,
      error_message: adminEmailResponse.error || null,
      language: language,
      quiz_lead_id: quizLeadId,
      resend_attempts: adminEmailResponse.attempts - 1,
      last_attempt_at: new Date().toISOString(),
      html_body: adminEmailHtml,
    });
    
    if (!adminEmailResponse.success) {
      console.error("Admin email error after all retries:", adminEmailResponse.error);
    }

    return new Response(JSON.stringify({ success: true }), {
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
