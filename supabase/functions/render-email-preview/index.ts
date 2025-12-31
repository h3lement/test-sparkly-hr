import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// Email translations (same as send-quiz-results)
const emailTranslations: Record<string, {
  subject: string;
  yourResults: string;
  outOf: string;
  points: string;
  keyInsights: string;
  wantToImprove: string;
  ctaDescription: string;
  visitSparkly: string;
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
    leadershipOpenMindedness: 'Aufgeschlossene Führung',
    openMindednessOutOf: 'von 4',
  },
};

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

// Fetch dynamic content from quiz_result_levels and cta_templates
async function fetchDynamicEmailContent(
  supabase: any,
  quizId: string,
  score: number,
  language: string
): Promise<DynamicEmailContent | null> {
  try {
    console.log(`Fetching dynamic content for quiz ${quizId}, score ${score}, language ${language}`);
    
    // Fetch quiz info for primary language AND the linked CTA template ID
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('slug, primary_language, cta_template_id, cta_title, cta_description, cta_text, cta_url')
      .eq('id', quizId)
      .maybeSingle();
    
    if (quizError || !quiz) {
      console.log('Could not fetch quiz info:', quizError?.message);
      return null;
    }
    
    const primaryLang = quiz.primary_language || 'en';
    
    // Fetch result level for this score
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

    // Fetch CTA template linked to quiz via cta_template_id (correct relationship)
    let ctaTemplate = null;
    if (quiz.cta_template_id) {
      const { data: linkedCta, error: linkedCtaError } = await supabase
        .from('cta_templates')
        .select('cta_title, cta_description, cta_text, cta_url')
        .eq('id', quiz.cta_template_id)
        .maybeSingle();
      
      if (!linkedCtaError && linkedCta) {
        ctaTemplate = linkedCta;
        console.log('Using CTA linked to quiz via cta_template_id:', quiz.cta_template_id);
        console.log('CTA title from template:', JSON.stringify(linkedCta.cta_title));
      } else if (linkedCtaError) {
        console.log('Error fetching linked CTA template:', linkedCtaError.message);
      }
    }
    
    console.log('ctaSource is:', ctaTemplate ? 'CTA template' : 'quiz fallback');

    const ctaSource = ctaTemplate || quiz;
    
    // Process insights
    let processedInsights: string[] = [];
    if (Array.isArray(resultLevel.insights)) {
      processedInsights = resultLevel.insights.map((insight: any) => {
        if (typeof insight === 'string') return insight;
        if (typeof insight === 'object' && insight !== null) {
          return insight[language] || insight[primaryLang] || insight['en'] || '';
        }
        return '';
      }).filter((i: string) => i.trim() !== '');
    }
    
    return {
      resultTitle: getLocalizedValue(resultLevel.title, language, primaryLang, 'Your Result'),
      resultDescription: getLocalizedValue(resultLevel.description, language, primaryLang, ''),
      insights: processedInsights,
      ctaTitle: getLocalizedValue(ctaSource.cta_title, language, primaryLang, ''),
      ctaDescription: getLocalizedValue(ctaSource.cta_description, language, primaryLang, ''),
      ctaButtonText: getLocalizedValue(ctaSource.cta_text, language, primaryLang, 'Continue to Sparkly.hr'),
      ctaUrl: ctaSource.cta_url || 'https://sparkly.hr',
      emoji: resultLevel.emoji || '🌟',
    };
  } catch (error: any) {
    console.error('Error in fetchDynamicEmailContent:', error.message);
    return null;
  }
}

// Fetch open-mindedness result level
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
    
    if (error || !omLevel) return null;
    
    return {
      title: getLocalizedValue(omLevel.title, language, primaryLang, ''),
      description: getLocalizedValue(omLevel.description, language, primaryLang, ''),
    };
  } catch (e) {
    return null;
  }
}

// Build email HTML (same structure as send-quiz-results)
function buildEmailHtml(
  language: string,
  trans: typeof emailTranslations['en'],
  data: {
    totalScore: number;
    maxScore: number;
    opennessScore?: number;
    opennessMaxScore: number;
    opennessTitle: string;
    opennessDescription: string;
    dynamicContent: DynamicEmailContent | null;
  }
): string {
  const { totalScore, maxScore, opennessScore, opennessMaxScore, opennessTitle, opennessDescription, dynamicContent } = data;
  
  const finalResultTitle = dynamicContent?.resultTitle || 'Your Result';
  const finalResultDescription = dynamicContent?.resultDescription || '';
  const finalInsights = dynamicContent?.insights || [];
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
  
  // Build insights list
  const insightsHtml = safeInsights.length > 0 ? safeInsights.map(insight => `
    <tr>
      <td style="padding: 8px 0; vertical-align: top;">
        <span style="display: inline-block; width: 8px; height: 8px; background: linear-gradient(135deg, #6d28d9, #a855f7); border-radius: 50%; margin-right: 12px; margin-top: 6px;"></span>
      </td>
      <td style="padding: 8px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">${insight}</td>
    </tr>
  `).join('') : '';

  // Open-mindedness section
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

  // CTA section
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
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2026 Sparkly.hr</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <div style="text-align: center; padding: 16px; background: #fef3c7; border-top: 2px dashed #f59e0b; margin-top: 0;">
        <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 600;">⚠️ PREVIEW ONLY - This email has not been sent</p>
      </div>
    </body>
    </html>
  `;
}

interface RenderPreviewRequest {
  leadId: string;
  leadType: 'quiz' | 'hypothesis';
}

const handler = async (req: Request): Promise<Response> => {
  console.log("render-email-preview function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, leadType }: RenderPreviewRequest = await req.json();

    if (!leadId || !leadType) {
      return new Response(
        JSON.stringify({ error: "Missing leadId or leadType" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let lead: any = null;
    let quizId: string | null = null;
    let score = 0;
    let totalQuestions = 0;
    let opennessScore: number | undefined;
    let language = 'en';

    const fetchLead = async (type: 'quiz' | 'hypothesis') => {
      const table = type === 'quiz' ? 'quiz_leads' : 'hypothesis_leads';
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', leadId)
        .maybeSingle();

      if (error) {
        console.warn(`Error fetching lead from ${table}: ${error.message}`);
        return { type, data: null as any };
      }

      return { type, data };
    };

    let leadTypeUsed: 'quiz' | 'hypothesis' = leadType;
    let leadResult = await fetchLead(leadType);

    // Fallback: if the requested leadType is wrong, try the other table before failing.
    if (!leadResult.data) {
      const fallbackType: 'quiz' | 'hypothesis' = leadType === 'quiz' ? 'hypothesis' : 'quiz';
      console.log(`Lead ${leadId} not found in ${leadType}, trying ${fallbackType}`);
      leadResult = await fetchLead(fallbackType);

      if (!leadResult.data) {
        return new Response(
          JSON.stringify({ error: "Lead not found", leadId, leadTypeRequested: leadType }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      leadTypeUsed = fallbackType;
    }

    lead = leadResult.data;
    quizId = lead.quiz_id;
    score = lead.score;
    totalQuestions = lead.total_questions;
    opennessScore = lead.openness_score ?? undefined;
    language = lead.language || 'en';

    if (!quizId) {
      return new Response(
        JSON.stringify({ error: "Lead has no associated quiz" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch quiz for primary language
    const { data: quiz } = await supabase
      .from('quizzes')
      .select('primary_language')
      .eq('id', quizId)
      .single();

    const primaryLang = quiz?.primary_language || 'en';
    const trans = emailTranslations[language] || emailTranslations['en'];

    // Fetch dynamic content
    const dynamicContent = await fetchDynamicEmailContent(supabase, quizId, score, language);

    // Fetch open-mindedness result if applicable
    let opennessTitle = '';
    let opennessDescription = '';
    if (opennessScore !== undefined) {
      const omResult = await fetchOpenMindednessResult(supabase, quizId, opennessScore, language, primaryLang);
      if (omResult) {
        opennessTitle = omResult.title;
        opennessDescription = omResult.description;
      }
    }

    // Build the email HTML
    const html = buildEmailHtml(language, trans, {
      totalScore: score,
      maxScore: totalQuestions,
      opennessScore,
      opennessMaxScore: 4,
      opennessTitle,
      opennessDescription,
      dynamicContent,
    });

    // Build subject line
    const subject = dynamicContent?.resultTitle 
      ? `${dynamicContent.emoji} ${dynamicContent.resultTitle}` 
      : trans.subject;

    console.log(`Email preview rendered for ${leadTypeUsed} lead ${leadId}`);

    return new Response(
      JSON.stringify({ 
        html,
        subject,
        language,
        score,
        totalQuestions,
        resultTitle: dynamicContent?.resultTitle || 'Your Result',
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in render-email-preview:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to render email preview" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
