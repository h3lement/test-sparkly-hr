import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailConfig {
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
}

async function getEmailConfig(supabase: any): Promise<EmailConfig> {
  const defaults: EmailConfig = {
    senderName: "Sparkly",
    senderEmail: "noreply@sparkly.hr",
    replyToEmail: "",
  };

  try {
    const settingKeys = ["email_sender_name", "email_sender_email", "email_reply_to"];
    
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
        }
      });
    }
  } catch (error) {
    console.error("Error fetching email config:", error);
  }
  
  return defaults;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getLocalizedValue(obj: Record<string, string> | null, lang: string, fallbackLang: string, defaultValue: string): string {
  if (!obj) return defaultValue;
  return obj[lang] || obj[fallbackLang] || obj['en'] || defaultValue;
}

// Sedona Scale levels with translations
const sedonaLevels: Record<number, Record<string, { name: string; description: string }>> = {
  1: {
    en: { name: "Apathy", description: "Low energy, feeling stuck or hopeless" },
    et: { name: "Apaatia", description: "Madal energia, tunne, et oled kinni jäänud" },
    de: { name: "Apathie", description: "Niedrige Energie, festgefahren oder hoffnungslos" },
    hr: { name: "Apatija", description: "Niska energija, osjećaj zaglavljenosti" },
  },
  2: {
    en: { name: "Grief", description: "Sadness, sense of loss or regret" },
    et: { name: "Lein", description: "Kurbus, kaotuse tunne" },
    de: { name: "Trauer", description: "Traurigkeit, Verlustgefühl" },
    hr: { name: "Tuga", description: "Osjećaj gubitka ili žaljenja" },
  },
  3: {
    en: { name: "Fear", description: "Worry, anxiety, feeling threatened" },
    et: { name: "Hirm", description: "Mure, ärevus, ohu tunne" },
    de: { name: "Angst", description: "Sorge, Angst, Bedrohungsgefühl" },
    hr: { name: "Strah", description: "Zabrinutost, tjeskoba" },
  },
  4: {
    en: { name: "Lust", description: "Strong desires, cravings, attachments" },
    et: { name: "Iha", description: "Tugevad soovid, kiindumused" },
    de: { name: "Begierde", description: "Starke Wünsche, Anhaftungen" },
    hr: { name: "Žudnja", description: "Snažne želje, privrženosti" },
  },
  5: {
    en: { name: "Anger", description: "Frustration, resentment, irritation" },
    et: { name: "Viha", description: "Frustratsioon, pahameel, ärrituvus" },
    de: { name: "Wut", description: "Frustration, Groll, Reizbarkeit" },
    hr: { name: "Ljutnja", description: "Frustracija, ogorčenost" },
  },
  6: {
    en: { name: "Pride", description: "Self-importance, need for recognition" },
    et: { name: "Uhkus", description: "Enesekesksus, tunnustuse vajadus" },
    de: { name: "Stolz", description: "Selbstwichtigkeit, Anerkennungsbedürfnis" },
    hr: { name: "Ponos", description: "Samouvažavanje, potreba za priznanjem" },
  },
  7: {
    en: { name: "Courage", description: "Willingness to grow and change" },
    et: { name: "Julgus", description: "Valmisolek kasvada ja muutuda" },
    de: { name: "Mut", description: "Bereitschaft zu wachsen und sich zu ändern" },
    hr: { name: "Hrabrost", description: "Spremnost na rast i promjenu" },
  },
  8: {
    en: { name: "Acceptance", description: "Inner peace, flow with life" },
    et: { name: "Aktsepteerimine", description: "Sisemine rahu, eluga kaasaminevus" },
    de: { name: "Akzeptanz", description: "Innerer Frieden, im Fluss mit dem Leben" },
    hr: { name: "Prihvaćanje", description: "Unutarnji mir, slijed života" },
  },
  9: {
    en: { name: "Peace", description: "Profound contentment, serenity" },
    et: { name: "Rahu", description: "Sügav rahulolu, selgus" },
    de: { name: "Frieden", description: "Tiefe Zufriedenheit, Gelassenheit" },
    hr: { name: "Mir", description: "Duboko zadovoljstvo, spokojstvo" },
  },
};

const emailTranslations: Record<string, {
  subject: string;
  yourResults: string;
  averageScore: string;
  levelLabel: string;
  commonExperiences: string;
  pathForward: string;
  whatThisMeans: string;
  sedonaScaleTitle: string;
  readyToLearnMore: string;
  ctaDescription: string;
  visitSparkly: string;
  tryAgain: string;
}> = {
  en: {
    subject: "Your Emotional State Assessment Results",
    yourResults: "Your Emotional Profile",
    averageScore: "Average Score (1-9 scale)",
    levelLabel: "Level",
    commonExperiences: "Common Experiences",
    pathForward: "Path Forward",
    whatThisMeans: "What This Means",
    sedonaScaleTitle: "The Sedona Emotional Scale",
    readyToLearnMore: "Ready for Deeper Self-Understanding?",
    ctaDescription: "This assessment provides insights into your current emotional state. For personalized guidance and support, continue to our resources.",
    visitSparkly: "Visit Sparkly.hr",
    tryAgain: "Take Assessment Again",
  },
  et: {
    subject: "Teie emotsionaalse seisundi hindamise tulemused",
    yourResults: "Teie emotsionaalne profiil",
    averageScore: "Keskmine skoor (skaala 1-9)",
    levelLabel: "Tase",
    commonExperiences: "Levinud kogemused",
    pathForward: "Edasine tee",
    whatThisMeans: "Mida see tähendab",
    sedonaScaleTitle: "Sedona emotsionaalne skaala",
    readyToLearnMore: "Valmis sügavamaks enesetundmiseks?",
    ctaDescription: "See hinnang annab ülevaate teie praegusest emotsionaalsest seisundist.",
    visitSparkly: "Külasta Sparkly.hr",
    tryAgain: "Tee test uuesti",
  },
  de: {
    subject: "Ihre Ergebnisse der emotionalen Zustandsbewertung",
    yourResults: "Ihr emotionales Profil",
    averageScore: "Durchschnittliche Punktzahl (Skala 1-9)",
    levelLabel: "Stufe",
    commonExperiences: "Häufige Erfahrungen",
    pathForward: "Der Weg nach vorn",
    whatThisMeans: "Was das bedeutet",
    sedonaScaleTitle: "Die Sedona-Emotionsskala",
    readyToLearnMore: "Bereit für tieferes Selbstverständnis?",
    ctaDescription: "Diese Bewertung gibt Einblicke in Ihren aktuellen emotionalen Zustand.",
    visitSparkly: "Besuchen Sie Sparkly.hr",
    tryAgain: "Bewertung wiederholen",
  },
  hr: {
    subject: "Rezultati procjene vašeg emocionalnog stanja",
    yourResults: "Vaš emocionalni profil",
    averageScore: "Prosječni rezultat (ljestvica 1-9)",
    levelLabel: "Razina",
    commonExperiences: "Uobičajena iskustva",
    pathForward: "Put naprijed",
    whatThisMeans: "Što to znači",
    sedonaScaleTitle: "Sedona emocionalna ljestvica",
    readyToLearnMore: "Spremni za dublje razumijevanje sebe?",
    ctaDescription: "Ova procjena pruža uvid u vaše trenutno emocionalno stanje.",
    visitSparkly: "Posjetite Sparkly.hr",
    tryAgain: "Ponovite procjenu",
  },
};

interface DynamicResultLevel {
  title: string;
  description: string;
  emoji: string;
  color: string;
  insights: string[];
}

interface DynamicCtaContent {
  ctaTitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaUrl: string;
  ctaRetryText: string;
  ctaRetryUrl: string;
}

function colorClassToHex(colorClass: string | null): string {
  if (!colorClass) return "#6d28d9";
  
  const colorMap: Record<string, string> = {
    "from-slate-500": "#64748b",
    "from-red-500": "#ef4444",
    "from-orange-500": "#f97316",
    "from-amber-500": "#f59e0b",
    "from-yellow-500": "#eab308",
    "from-lime-500": "#84cc16",
    "from-green-500": "#22c55e",
    "from-emerald-500": "#10b981",
    "from-teal-500": "#14b8a6",
    "from-cyan-500": "#06b6d4",
    "from-sky-500": "#0ea5e9",
    "from-blue-500": "#3b82f6",
    "from-indigo-500": "#6366f1",
    "from-violet-500": "#8b5cf6",
    "from-purple-500": "#a855f7",
    "from-fuchsia-500": "#d946ef",
    "from-pink-500": "#ec4899",
    "from-rose-500": "#f43f5e",
  };
  
  for (const [key, value] of Object.entries(colorMap)) {
    if (colorClass.includes(key)) return value;
  }
  
  return "#6d28d9";
}

async function fetchDynamicContent(
  supabase: any,
  quizId: string,
  language: string,
  averageScore: number
): Promise<{ resultLevel: DynamicResultLevel | null; cta: DynamicCtaContent }> {
  const defaultCta: DynamicCtaContent = {
    ctaTitle: "",
    ctaDescription: "",
    ctaButtonText: "",
    ctaUrl: "https://sparkly.hr",
    ctaRetryText: "",
    ctaRetryUrl: "",
  };

  try {
    // Fetch quiz data for CTA
    const { data: quizData } = await supabase
      .from("quizzes")
      .select("cta_title, cta_description, cta_text, cta_url, cta_retry_text, cta_retry_url, cta_template_id, slug")
      .eq("id", quizId)
      .maybeSingle();

    if (quizData) {
      // Try to get CTA from template first
      if (quizData.cta_template_id) {
        const { data: ctaTemplate } = await supabase
          .from("cta_templates")
          .select("*")
          .eq("id", quizData.cta_template_id)
          .eq("is_live", true)
          .maybeSingle();

        if (ctaTemplate) {
          defaultCta.ctaTitle = getLocalizedValue(ctaTemplate.cta_title, language, 'en', '');
          defaultCta.ctaDescription = getLocalizedValue(ctaTemplate.cta_description, language, 'en', '');
          defaultCta.ctaButtonText = getLocalizedValue(ctaTemplate.cta_text, language, 'en', '');
          defaultCta.ctaUrl = ctaTemplate.cta_url || defaultCta.ctaUrl;
          defaultCta.ctaRetryText = getLocalizedValue(ctaTemplate.cta_retry_text, language, 'en', '');
          defaultCta.ctaRetryUrl = ctaTemplate.cta_retry_url || `/${quizData.slug}`;
        }
      }

      // Fallback to quiz-level CTA
      if (!defaultCta.ctaTitle) {
        defaultCta.ctaTitle = getLocalizedValue(quizData.cta_title, language, 'en', '');
        defaultCta.ctaDescription = getLocalizedValue(quizData.cta_description, language, 'en', '');
        defaultCta.ctaButtonText = getLocalizedValue(quizData.cta_text, language, 'en', '');
        defaultCta.ctaUrl = quizData.cta_url || defaultCta.ctaUrl;
        defaultCta.ctaRetryText = getLocalizedValue(quizData.cta_retry_text, language, 'en', '');
        defaultCta.ctaRetryUrl = quizData.cta_retry_url || `/${quizData.slug}`;
      }
    }

    // Fetch result level based on score
    // Emotional quiz stores score as average * 10 (e.g., 5.5 = 55)
    const scaledScore = Math.round(averageScore * 10);
    
    const { data: resultLevels } = await supabase
      .from("quiz_result_levels")
      .select("*")
      .eq("quiz_id", quizId)
      .order("min_score", { ascending: true });

    if (resultLevels && resultLevels.length > 0) {
      const matchedLevel = resultLevels.find(
        (level: any) => scaledScore >= level.min_score && scaledScore <= level.max_score
      ) || resultLevels[resultLevels.length - 1];

      if (matchedLevel) {
        const insights = matchedLevel.insights || [];
        const localizedInsights = insights.map((insight: any) => 
          typeof insight === 'object' ? getLocalizedValue(insight, language, 'en', '') : String(insight)
        ).filter(Boolean);

        return {
          resultLevel: {
            title: getLocalizedValue(matchedLevel.title, language, 'en', ''),
            description: getLocalizedValue(matchedLevel.description, language, 'en', ''),
            emoji: matchedLevel.emoji || '🧘',
            color: colorClassToHex(matchedLevel.color_class),
            insights: localizedInsights,
          },
          cta: defaultCta,
        };
      }
    }

    return { resultLevel: null, cta: defaultCta };
  } catch (error) {
    console.error("Error fetching dynamic content:", error);
    return { resultLevel: null, cta: defaultCta };
  }
}

function buildEmailHtml(
  trans: typeof emailTranslations['en'],
  language: string,
  averageScore: number,
  emotionalLevel: number,
  resultLevel: DynamicResultLevel | null,
  cta: DynamicCtaContent
): string {
  const logoUrl = "https://sparkly.hr/wp-content/uploads/2025/06/sparkly-logo.png";
  const percentage = Math.round((averageScore / 9) * 100);
  
  // Get Sedona level info
  const sedonaLevel = sedonaLevels[emotionalLevel]?.[language] || sedonaLevels[emotionalLevel]?.['en'] || { name: "Unknown", description: "" };
  
  // Use dynamic result level or fallback
  const resultTitle = resultLevel?.title || sedonaLevel.name;
  const resultDescription = resultLevel?.description || sedonaLevel.description;
  const resultEmoji = resultLevel?.emoji || '🧘';
  const resultColor = resultLevel?.color || '#6d28d9';
  const insights = resultLevel?.insights || [];
  
  // Split insights: first 2 for Common Experiences, rest for Path Forward
  const commonExperiences = insights.slice(0, 2);
  const pathForward = insights.slice(2, 4);

  // Build Sedona scale visualization
  const scaleHtml = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
    const isActive = level === emotionalLevel;
    const levelInfo = sedonaLevels[level]?.[language] || sedonaLevels[level]?.['en'] || { name: String(level), description: "" };
    return `
      <td style="width: 11%; text-align: center; padding: 4px 2px;">
        <div style="background: ${isActive ? resultColor : '#e5e7eb'}; color: ${isActive ? 'white' : '#6b7280'}; border-radius: 8px; padding: 8px 4px; font-weight: ${isActive ? '700' : '400'}; font-size: 14px;">
          ${level}
        </div>
        <div style="font-size: 9px; color: #9ca3af; margin-top: 4px; line-height: 1.2;">${escapeHtml(levelInfo.name)}</div>
      </td>
    `;
  }).join('');

  // Common Experiences HTML
  const commonExperiencesHtml = commonExperiences.length > 0 ? `
    <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
      <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0; font-weight: 600;">
        <span style="margin-right: 8px;">💭</span>${escapeHtml(trans.commonExperiences)}
      </h3>
      <ul style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.8;">
        ${commonExperiences.map(exp => `<li style="margin-bottom: 8px;">${escapeHtml(exp)}</li>`).join('')}
      </ul>
    </div>
  ` : '';

  // Path Forward HTML
  const pathForwardHtml = pathForward.length > 0 ? `
    <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
      <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0; font-weight: 600;">
        <span style="margin-right: 8px;">🌱</span>${escapeHtml(trans.pathForward)}
      </h3>
      <ol style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.8;">
        ${pathForward.map(step => `<li style="margin-bottom: 8px;">${escapeHtml(step)}</li>`).join('')}
      </ol>
    </div>
  ` : '';

  // CTA section
  const ctaTitle = cta.ctaTitle || trans.readyToLearnMore;
  const ctaDesc = cta.ctaDescription || trans.ctaDescription;
  const ctaButtonText = cta.ctaButtonText || trans.visitSparkly;
  const ctaRetryText = cta.ctaRetryText || trans.tryAgain;
  
  const retryButtonHtml = cta.ctaRetryUrl ? `
    <a href="${cta.ctaRetryUrl}" style="display: inline-block; background: transparent; border: 2px solid #6d28d9; color: #6d28d9; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-left: 12px;">${escapeHtml(ctaRetryText)}</a>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="${language}">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${escapeHtml(trans.yourResults)}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8f4f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8f4f0; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background: white; border-radius: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${resultColor}, ${resultColor}cc); padding: 40px 40px 32px 40px; text-align: center;">
                  <a href="https://sparkly.hr" target="_blank">
                    <img src="${logoUrl}" alt="Sparkly.hr" style="height: 44px; margin-bottom: 24px;" />
                  </a>
                  <h1 style="color: white; font-size: 26px; margin: 0; font-weight: 700;">${escapeHtml(trans.yourResults)}</h1>
                </td>
              </tr>
              
              <!-- Score Card -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="background: linear-gradient(135deg, ${resultColor}22, ${resultColor}11); border: 2px solid ${resultColor}44; border-radius: 16px; padding: 32px; margin-top: -20px; text-align: center;">
                    <div style="font-size: 56px; margin-bottom: 8px;">${resultEmoji}</div>
                    <div style="font-size: 24px; font-weight: 700; color: ${resultColor}; margin-bottom: 8px;">${escapeHtml(resultTitle)}</div>
                    <div style="font-size: 42px; font-weight: 800; color: ${resultColor}; margin-bottom: 4px;">${averageScore.toFixed(1)}</div>
                    <div style="color: #6b7280; font-size: 14px; font-weight: 500;">${escapeHtml(trans.averageScore)}</div>
                    <div style="margin-top: 12px; display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: ${resultColor}; color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">
                      ${escapeHtml(trans.levelLabel)} ${emotionalLevel}: ${escapeHtml(sedonaLevel.name)}
                    </div>
                  </div>
                </td>
              </tr>
              
              <!-- Sedona Scale -->
              <tr>
                <td style="padding: 28px 40px 0 40px;">
                  <h3 style="color: #6b7280; font-size: 12px; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">${escapeHtml(trans.sedonaScaleTitle)}</h3>
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      ${scaleHtml}
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- What This Means -->
              <tr>
                <td style="padding: 28px 40px 0 40px;">
                  <div style="background: #faf5ff; border-radius: 12px; padding: 24px;">
                    <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 12px 0; font-weight: 600;">${escapeHtml(trans.whatThisMeans)}</h3>
                    <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0;">${escapeHtml(resultDescription)}</p>
                  </div>
                </td>
              </tr>
              
              <!-- Common Experiences -->
              ${commonExperiencesHtml ? `<tr><td style="padding: 20px 40px 0 40px;">${commonExperiencesHtml}</td></tr>` : ''}
              
              <!-- Path Forward -->
              ${pathForwardHtml ? `<tr><td style="padding: 0 40px;">${pathForwardHtml}</td></tr>` : ''}
              
              <!-- CTA -->
              <tr>
                <td style="padding: 20px 40px 40px 40px;">
                  <div style="background: linear-gradient(135deg, #f3e8ff, #ede9fe); border-radius: 16px; padding: 32px; text-align: center; border: 1px solid #e9d5ff;">
                    <h3 style="color: #6d28d9; font-size: 20px; margin: 0 0 12px 0; font-weight: 600;">${escapeHtml(ctaTitle)}</h3>
                    <p style="color: #7c3aed; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">${escapeHtml(ctaDesc)}</p>
                    <div style="display: inline-block;">
                      <a href="${cta.ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">${escapeHtml(ctaButtonText)}</a>
                      ${retryButtonHtml}
                    </div>
                  </div>
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
    </body>
    </html>
  `;
}

interface EmotionalEmailRequest {
  email: string;
  averageScore: number;
  emotionalLevel: number;
  quizId: string;
  language: string;
  existingLeadId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: EmotionalEmailRequest = await req.json();
    const { email, averageScore, emotionalLevel, quizId, language, existingLeadId } = body;

    console.log("Sending emotional user email for:", email, "score:", averageScore, "level:", emotionalLevel);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if email sending is enabled globally
    const { data: emailEnabledSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "email_sending_enabled")
      .maybeSingle();

    if (emailEnabledSetting?.setting_value === "false") {
      console.log("Email sending is disabled globally, skipping");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "email_sending_disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const quizLeadId = existingLeadId;

    // Check for duplicate user email
    if (quizLeadId) {
      const { data: existingUserEmail } = await supabase
        .from("email_queue")
        .select("id")
        .eq("quiz_lead_id", quizLeadId)
        .in("email_type", ["Quiz Taker", "quiz_result_user"])
        .in("status", ["pending", "processing", "sent"])
        .limit(1)
        .maybeSingle();

      const { data: existingUserLog } = await supabase
        .from("email_logs")
        .select("id")
        .eq("quiz_lead_id", quizLeadId)
        .in("email_type", ["Quiz Taker", "quiz_result_user"])
        .limit(1)
        .maybeSingle();

      if (existingUserEmail || existingUserLog) {
        console.log("User email already queued/sent for lead:", quizLeadId);
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "duplicate" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const emailConfig = await getEmailConfig(supabase);
    const trans = emailTranslations[language] || emailTranslations['en'];

    // Fetch dynamic content
    const { resultLevel, cta } = await fetchDynamicContent(supabase, quizId, language, averageScore);

    // Build email HTML
    const emailHtml = buildEmailHtml(trans, language, averageScore, emotionalLevel, resultLevel, cta);
    const emailSubject = `${trans.subject}: ${resultLevel?.title || trans.yourResults}`;

    // Queue user email
    const { error: userQueueError } = await supabase.from("email_queue").insert({
      recipient_email: email,
      sender_email: emailConfig.senderEmail,
      sender_name: emailConfig.senderName,
      subject: emailSubject,
      html_body: emailHtml,
      email_type: "Quiz Taker",
      quiz_lead_id: quizLeadId || null,
      quiz_id: quizId,
      language: language,
      reply_to_email: emailConfig.replyToEmail || null,
    });

    if (userQueueError) {
      console.error("Error queuing user email:", userQueueError);
    } else {
      console.log("User email queued successfully");
    }

    // Update lead with email content for instant preview
    if (quizLeadId) {
      const { error: updateLeadError } = await supabase
        .from("quiz_leads")
        .update({ email_html: emailHtml, email_subject: emailSubject })
        .eq("id", quizLeadId);

      if (updateLeadError) {
        console.error("Error updating lead with email content:", updateLeadError);
      }
    }

    // Queue admin notification email (same content)
    const adminEmailSubject = `[Admin Copy] ${emailSubject} (from ${escapeHtml(email)})`;

    // Get admin notification email from settings
    const { data: adminEmailSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "admin_notification_email")
      .maybeSingle();
    
    const adminRecipient = adminEmailSetting?.setting_value || "mikk@sparkly.hr";

    // Check for duplicate admin email - check by recipient + quiz_id + recent time window
    let shouldSendAdmin = true;
    
    if (quizLeadId) {
      const { data: existingAdminEmail } = await supabase
        .from("email_queue")
        .select("id")
        .eq("quiz_lead_id", quizLeadId)
        .in("email_type", ["Admin Notification", "quiz_result_admin"])
        .in("status", ["pending", "processing", "sent"])
        .limit(1)
        .maybeSingle();

      const { data: existingAdminLog } = await supabase
        .from("email_logs")
        .select("id")
        .eq("quiz_lead_id", quizLeadId)
        .in("email_type", ["Admin Notification", "quiz_result_admin"])
        .limit(1)
        .maybeSingle();

      if (existingAdminEmail || existingAdminLog) {
        shouldSendAdmin = false;
        console.log("Admin email already sent for lead:", quizLeadId);
      }
    } else {
      // No lead ID - check by email + quiz + time window (last 60 seconds) to prevent duplicates
      const recentTime = new Date(Date.now() - 60000).toISOString();
      const { data: recentAdminEmail } = await supabase
        .from("email_queue")
        .select("id")
        .eq("quiz_id", quizId)
        .eq("email_type", "Admin Notification")
        .ilike("subject", `%${email}%`)
        .gte("created_at", recentTime)
        .limit(1)
        .maybeSingle();

      if (recentAdminEmail) {
        shouldSendAdmin = false;
        console.log("Recent admin email already queued for:", email);
      }
    }

    if (shouldSendAdmin) {
      const { error: adminQueueError } = await supabase.from("email_queue").insert({
        recipient_email: adminRecipient,
        sender_email: emailConfig.senderEmail,
        sender_name: emailConfig.senderName,
        subject: adminEmailSubject,
        html_body: emailHtml,
        email_type: "Admin Notification",
        quiz_lead_id: quizLeadId || null,
        quiz_id: quizId,
        language: language,
        reply_to_email: emailConfig.replyToEmail || null,
      });

      if (adminQueueError) {
        console.error("Error queuing admin email:", adminQueueError);
      } else {
        console.log("Admin email queued successfully to:", adminRecipient);
      }
    }

    return new Response(JSON.stringify({ success: true, leadId: quizLeadId }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-emotional-user-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
