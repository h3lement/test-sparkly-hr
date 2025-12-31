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

function getLocalizedValue(
  jsonObj: Record<string, string> | null | undefined,
  language: string,
  primaryLanguage: string = 'en',
  fallback: string = ''
): string {
  if (!jsonObj) return fallback;
  return jsonObj[language] || jsonObj[primaryLanguage] || jsonObj['en'] || fallback;
}

// Dynamic CTA content structure
interface DynamicCtaContent {
  ctaTitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaUrl: string;
  ctaRetryText: string;
  ctaRetryUrl: string;
  quizTitle: string;
  quizSlug: string;
}

// Dynamic result level from database
interface DynamicResultLevel {
  title: string;
  description: string;
  emoji: string;
  color: string;
}

// Fetch dynamic CTA content from cta_templates table (matching send-quiz-results pattern)
async function fetchDynamicCtaContent(
  supabase: any,
  quizId: string,
  language: string
): Promise<DynamicCtaContent> {
  const defaults: DynamicCtaContent = {
    ctaTitle: '',
    ctaDescription: '',
    ctaButtonText: '',
    ctaUrl: 'https://sparkly.hr',
    ctaRetryText: '',
    ctaRetryUrl: '',
    quizTitle: '',
    quizSlug: '',
  };

  try {
    console.log(`Fetching dynamic CTA for quiz ${quizId}, language ${language}`);
    
    // Fetch quiz info with cta_template_id
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('slug, title, primary_language, cta_template_id, cta_title, cta_description, cta_text, cta_url, cta_retry_text, cta_retry_url')
      .eq('id', quizId)
      .maybeSingle();
    
    if (quizError || !quiz) {
      console.log('Could not fetch quiz info:', quizError?.message);
      return defaults;
    }
    
    const primaryLang = quiz.primary_language || 'en';
    console.log(`Quiz ${quiz.slug} - primary language: ${primaryLang}, cta_template_id: ${quiz.cta_template_id || 'none'}`);
    
    let ctaTemplate = null;
    
    // Priority 1: Fetch CTA template linked to quiz via cta_template_id
    if (quiz.cta_template_id) {
      const { data: linkedCta, error: linkedCtaError } = await supabase
        .from('cta_templates')
        .select('cta_title, cta_description, cta_text, cta_url, cta_retry_text, cta_retry_url')
        .eq('id', quiz.cta_template_id)
        .maybeSingle();
      
      if (!linkedCtaError && linkedCta) {
        ctaTemplate = linkedCta;
        console.log('Using CTA linked to quiz via cta_template_id:', quiz.cta_template_id);
      } else if (linkedCtaError) {
        console.log('Error fetching linked CTA template:', linkedCtaError.message);
      }
    }
    
    // Priority 2: Fetch live CTA template for this quiz (fallback)
    if (!ctaTemplate) {
      const { data: liveCta, error: liveCtaError } = await supabase
        .from('cta_templates')
        .select('cta_title, cta_description, cta_text, cta_url, cta_retry_text, cta_retry_url')
        .eq('quiz_id', quizId)
        .eq('is_live', true)
        .maybeSingle();
      
      if (!liveCtaError && liveCta) {
        ctaTemplate = liveCta;
        console.log('Using live CTA for quiz (fallback)');
      } else if (liveCtaError) {
        console.log('Error fetching live CTA template:', liveCtaError.message);
      }
    }

    // Use CTA from cta_templates if available, fallback to quizzes table
    const ctaSource = ctaTemplate || quiz;
    
    // Build quiz URL for retry button fallback
    const quizUrl = `https://itcnukhlqkrsirrznuig.lovable.app/q/${quiz.slug}`;
    
    const dynamicCta: DynamicCtaContent = {
      ctaTitle: getLocalizedValue(ctaSource.cta_title, language, primaryLang, ''),
      ctaDescription: getLocalizedValue(ctaSource.cta_description, language, primaryLang, ''),
      ctaButtonText: getLocalizedValue(ctaSource.cta_text, language, primaryLang, ''),
      ctaUrl: ctaSource.cta_url || 'https://sparkly.hr',
      ctaRetryText: getLocalizedValue(ctaSource.cta_retry_text, language, primaryLang, ''),
      ctaRetryUrl: ctaSource.cta_retry_url || quizUrl,
      quizTitle: getLocalizedValue(quiz.title, language, primaryLang, 'Quiz'),
      quizSlug: quiz.slug,
    };
    
    console.log('Dynamic CTA fetched successfully:', {
      ctaTitle: dynamicCta.ctaTitle || '(none)',
      ctaButtonText: dynamicCta.ctaButtonText || '(none)',
      ctaUrl: dynamicCta.ctaUrl,
      ctaSource: ctaTemplate ? 'cta_templates' : 'quizzes',
    });
    
    return dynamicCta;
  } catch (error: any) {
    console.error('Error in fetchDynamicCtaContent:', error.message);
    return defaults;
  }
}

// Color class to hex color mapping for email rendering
function colorClassToHex(colorClass: string | null): string {
  const colorMap: Record<string, string> = {
    'from-green-500 to-emerald-600': '#10b981',
    'from-blue-500 to-indigo-600': '#3b82f6',
    'from-yellow-500 to-orange-600': '#f59e0b',
    'from-orange-500 to-red-600': '#f97316',
    'from-red-500 to-rose-600': '#ef4444',
    'from-purple-500 to-violet-600': '#8b5cf6',
    'from-cyan-500 to-blue-600': '#06b6d4',
    'from-emerald-500 to-green-600': '#10b981',
  };
  
  if (!colorClass) return '#10b981'; // Default green
  return colorMap[colorClass] || '#10b981';
}

// Fetch hypothesis result level from database based on score
async function fetchHypothesisResultLevel(
  supabase: any,
  quizId: string,
  score: number,
  language: string
): Promise<DynamicResultLevel | null> {
  try {
    console.log(`Fetching hypothesis result level for quiz ${quizId}, score ${score}, language ${language}`);
    
    // Fetch quiz primary language first
    const { data: quiz } = await supabase
      .from('quizzes')
      .select('primary_language')
      .eq('id', quizId)
      .maybeSingle();
    
    const primaryLang = quiz?.primary_language || 'en';
    
    // Fetch result level for this score
    const { data: resultLevel, error } = await supabase
      .from('hypothesis_result_levels')
      .select('title, description, emoji, color_class')
      .eq('quiz_id', quizId)
      .lte('min_score', score)
      .gte('max_score', score)
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.log('Error fetching hypothesis result level:', error.message);
      return null;
    }
    
    if (!resultLevel) {
      console.log(`No hypothesis result level found for score ${score}`);
      return null;
    }
    
    const dynamicResult: DynamicResultLevel = {
      title: getLocalizedValue(resultLevel.title, language, primaryLang, ''),
      description: getLocalizedValue(resultLevel.description, language, primaryLang, ''),
      emoji: resultLevel.emoji || '🏆',
      color: colorClassToHex(resultLevel.color_class),
    };
    
    console.log('Hypothesis result level fetched:', dynamicResult.title || '(none)', 'color:', dynamicResult.color);
    return dynamicResult;
  } catch (error: any) {
    console.error('Error in fetchHypothesisResultLevel:', error.message);
    return null;
  }
}

const emailTranslations: Record<string, {
  subject: string;
  yourResults: string;
  correctAnswers: string;
  outOf: string;
  keyLearnings: string;
  truthExplanation: string;
  interviewQuestion: string;
  forMen: string;
  forWomen: string;
  yourAnswer: string;
  correctAnswer: string;
  true: string;
  false: string;
  readyToLearnMore: string;
  ctaDescription: string;
  visitSparkly: string;
  openMindedness: string;
  openMindednessScore: string;
}> = {
  en: {
    subject: 'Your 50+ Workforce Quiz Results',
    yourResults: 'Your Quiz Results',
    correctAnswers: 'correct answers',
    outOf: 'out of',
    keyLearnings: 'Key Learnings',
    truthExplanation: 'The Truth',
    interviewQuestion: 'Interview Question',
    forMen: 'For Men 50+',
    forWomen: 'For Women 50+',
    yourAnswer: 'Your Answer',
    correctAnswer: 'Correct',
    true: 'True',
    false: 'False',
    readyToLearnMore: 'Want to Learn More?',
    ctaDescription: 'Discover more insights about managing and hiring 50+ employees effectively.',
    visitSparkly: 'Visit Sparkly.hr',
    openMindedness: 'Open-Mindedness',
    openMindednessScore: 'Your openness to diverse assessment methods',
  },
  et: {
    subject: 'Sinu 50+ tööjõu kviiside tulemused',
    yourResults: 'Sinu kviisi tulemused',
    correctAnswers: 'õiget vastust',
    outOf: 'vastusest',
    keyLearnings: 'Põhilised õppetunnid',
    truthExplanation: 'Tõde',
    interviewQuestion: 'Intervjuu küsimus',
    forMen: 'Meeste 50+ kohta',
    forWomen: 'Naiste 50+ kohta',
    yourAnswer: 'Sinu vastus',
    correctAnswer: 'Õige',
    true: 'Õige',
    false: 'Vale',
    readyToLearnMore: 'Tahad rohkem teada saada?',
    ctaDescription: 'Avasta rohkem teadmisi 50+ töötajate tõhusa juhtimise ja värbamise kohta.',
    visitSparkly: 'Külasta Sparkly.hr',
    openMindedness: 'Avatud mõtlemine',
    openMindednessScore: 'Sinu avatus erinevatele hindamismeetoditele',
  },
  de: {
    subject: 'Ihre 50+ Arbeitskraft-Quiz-Ergebnisse',
    yourResults: 'Ihre Quiz-Ergebnisse',
    correctAnswers: 'richtige Antworten',
    outOf: 'von',
    keyLearnings: 'Wichtige Erkenntnisse',
    truthExplanation: 'Die Wahrheit',
    interviewQuestion: 'Interview-Frage',
    forMen: 'Für Männer 50+',
    forWomen: 'Für Frauen 50+',
    yourAnswer: 'Ihre Antwort',
    correctAnswer: 'Richtig',
    true: 'Wahr',
    false: 'Falsch',
    readyToLearnMore: 'Möchten Sie mehr erfahren?',
    ctaDescription: 'Entdecken Sie mehr Einblicke in die effektive Führung und Einstellung von 50+ Mitarbeitern.',
    visitSparkly: 'Besuchen Sie Sparkly.hr',
    openMindedness: 'Aufgeschlossenheit',
    openMindednessScore: 'Ihre Offenheit für verschiedene Bewertungsmethoden',
  },
};

interface QuestionData {
  id: string;
  question_order: number;
  hypothesis_text: Record<string, string>;
  hypothesis_text_man: Record<string, string>;
  hypothesis_text_woman: Record<string, string>;
  interview_question: Record<string, string>;
  interview_question_man: Record<string, string>;
  interview_question_woman: Record<string, string>;
  truth_explanation: Record<string, string>;
  correct_answer_man: boolean;
  correct_answer_woman: boolean;
}

interface ResponseData {
  question_id: string;
  answer_man: boolean | null;
  answer_woman: boolean | null;
}

interface HypothesisUserEmailRequest {
  email: string;
  score: number;
  totalQuestions: number;
  quizId: string;
  quizTitle: string;
  language: string;
  sessionId: string;
  leadId?: string;
  opennessScore?: number | null;
}

function buildEmailHtml(
  trans: typeof emailTranslations['en'],
  language: string,
  score: number,
  totalQuestions: number,
  questions: QuestionData[],
  responses: ResponseData[],
  dynamicCta: DynamicCtaContent,
  dynamicResultLevel: DynamicResultLevel | null,
  opennessScore?: number | null
): string {
  const logoUrl = "https://sparkly.hr/wp-content/uploads/2025/06/sparkly-logo.png";
  const percentage = Math.round((score / totalQuestions) * 100);
  
  // Get assessment category based on percentage (fallback if no dynamic result level)
  const getAssessmentFallback = () => {
    if (percentage >= 90) return { label: "Bias Champion", emoji: "🏆", color: "#10b981" };
    if (percentage >= 70) return { label: "Bias Aware", emoji: "⭐", color: "#3b82f6" };
    if (percentage >= 50) return { label: "Bias Curious", emoji: "📚", color: "#f59e0b" };
    if (percentage >= 30) return { label: "Bias Discoverer", emoji: "🌱", color: "#f97316" };
    return { label: "Bias Explorer", emoji: "🔍", color: "#ef4444" };
  };
  
  // Use dynamic result level if available, otherwise fallback
  const fallback = getAssessmentFallback();
  const assessment = dynamicResultLevel 
    ? { label: dynamicResultLevel.title || fallback.label, emoji: dynamicResultLevel.emoji || fallback.emoji, color: dynamicResultLevel.color || fallback.color }
    : fallback;

  // Build response map for quick lookup
  const responseMap = new Map<string, ResponseData>();
  responses.forEach(r => responseMap.set(r.question_id, r));

  // Build questions HTML
  const questionsHtml = questions
    .sort((a, b) => a.question_order - b.question_order)
    .map((q, index) => {
      const response = responseMap.get(q.id);
      const hypothesisMan = getLocalizedValue(q.hypothesis_text_man, language, 'en', '');
      const hypothesisWoman = getLocalizedValue(q.hypothesis_text_woman, language, 'en', '');
      const interviewMan = getLocalizedValue(q.interview_question_man, language, 'en', '');
      const interviewWoman = getLocalizedValue(q.interview_question_woman, language, 'en', '');
      const truthExplanation = getLocalizedValue(q.truth_explanation, language, 'en', '');
      
      const userAnswerMan = response?.answer_man;
      const userAnswerWoman = response?.answer_woman;
      const correctMan = q.correct_answer_man;
      const correctWoman = q.correct_answer_woman;
      const isManCorrect = userAnswerMan === correctMan;
      const isWomanCorrect = userAnswerWoman === correctWoman;

      return `
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; margin-bottom: 16px;">
            <span style="background: ${isManCorrect && isWomanCorrect ? '#10b981' : isManCorrect || isWomanCorrect ? '#f59e0b' : '#ef4444'}; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; margin-right: 12px;">${index + 1}</span>
            <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Question ${index + 1}</span>
          </div>
          
          ${hypothesisMan ? `
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; margin-bottom: 12px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 4px 0; font-size: 11px; color: #15803d; font-weight: 600; text-transform: uppercase;">${escapeHtml(trans.forMen)}</p>
            <p style="margin: 0; color: #166534; font-size: 14px;">${escapeHtml(hypothesisMan)}</p>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: ${isManCorrect ? '#15803d' : '#dc2626'};">
              ${escapeHtml(trans.yourAnswer)}: ${userAnswerMan !== null ? (userAnswerMan ? trans.true : trans.false) : '—'}
              ${isManCorrect ? ' ✓' : ` (${trans.correctAnswer}: ${correctMan ? trans.true : trans.false})`}
            </p>
          </div>
          ` : ''}
          
          ${hypothesisWoman ? `
          <div style="background: #fdf4ff; border-left: 4px solid #d946ef; padding: 12px 16px; margin-bottom: 12px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 4px 0; font-size: 11px; color: #a21caf; font-weight: 600; text-transform: uppercase;">${escapeHtml(trans.forWomen)}</p>
            <p style="margin: 0; color: #86198f; font-size: 14px;">${escapeHtml(hypothesisWoman)}</p>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: ${isWomanCorrect ? '#15803d' : '#dc2626'};">
              ${escapeHtml(trans.yourAnswer)}: ${userAnswerWoman !== null ? (userAnswerWoman ? trans.true : trans.false) : '—'}
              ${isWomanCorrect ? ' ✓' : ` (${trans.correctAnswer}: ${correctWoman ? trans.true : trans.false})`}
            </p>
          </div>
          ` : ''}
          
          ${truthExplanation ? `
          <div style="background: #fefce8; border-left: 4px solid #eab308; padding: 12px 16px; margin-bottom: 12px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 4px 0; font-size: 11px; color: #a16207; font-weight: 600; text-transform: uppercase;">💡 ${escapeHtml(trans.truthExplanation)}</p>
            <p style="margin: 0; color: #854d0e; font-size: 14px; line-height: 1.5;">${escapeHtml(truthExplanation)}</p>
          </div>
          ` : ''}
          
          ${interviewMan || interviewWoman ? `
          <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 8px 0; font-size: 11px; color: #1d4ed8; font-weight: 600; text-transform: uppercase;">🎤 ${escapeHtml(trans.interviewQuestion)}</p>
            ${interviewMan ? `<p style="margin: 0 0 6px 0; color: #1e40af; font-size: 13px;"><strong>${trans.forMen}:</strong> ${escapeHtml(interviewMan)}</p>` : ''}
            ${interviewWoman ? `<p style="margin: 0; color: #1e40af; font-size: 13px;"><strong>${trans.forWomen}:</strong> ${escapeHtml(interviewWoman)}</p>` : ''}
          </div>
          ` : ''}
        </div>
      `;
    }).join('');

  return `
    <!DOCTYPE html>
    <html lang="${language}">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${escapeHtml(trans.yourResults)}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table cellpadding="0" cellspacing="0" border="0" width="640" style="max-width: 640px; background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #6d28d9, #a855f7); padding: 40px 40px 32px 40px; text-align: center;">
                  <a href="https://sparkly.hr" target="_blank">
                    <img src="${logoUrl}" alt="Sparkly.hr" style="height: 44px; margin-bottom: 24px;" />
                  </a>
                  <h1 style="color: white; font-size: 24px; margin: 0; font-weight: 700;">${escapeHtml(trans.yourResults)}</h1>
                </td>
              </tr>
              
              <!-- Score Card -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="background: linear-gradient(135deg, ${assessment.color}22, ${assessment.color}11); border: 2px solid ${assessment.color}44; border-radius: 16px; padding: 32px; margin-top: -20px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 8px;">${assessment.emoji}</div>
                    <div style="font-size: 28px; font-weight: 800; color: ${assessment.color}; margin-bottom: 4px;">${assessment.label}</div>
                    <div style="color: #6b7280; font-size: 16px; font-weight: 500;">
                      <span style="font-size: 36px; font-weight: 800; color: ${assessment.color};">${score}</span>
                      <span style="font-size: 18px;"> ${trans.outOf} ${totalQuestions}</span>
                      <span style="font-size: 14px;"> ${trans.correctAnswers}</span>
                    </div>
                    <div style="margin-top: 8px; font-size: 14px; color: #9ca3af;">${percentage}%</div>
                  </div>
                </td>
              </tr>
              
              ${opennessScore !== null && opennessScore !== undefined ? `
              <!-- Open-Mindedness Score -->
              <tr>
                <td style="padding: 24px 40px 0 40px;">
                  <div style="background: linear-gradient(135deg, #dbeafe, #ede9fe); border: 2px solid #93c5fd; border-radius: 16px; padding: 24px; text-align: center;">
                    <div style="font-size: 28px; margin-bottom: 8px;">🧠</div>
                    <div style="font-size: 18px; font-weight: 700; color: #1d4ed8; margin-bottom: 4px;">${escapeHtml(trans.openMindedness)}</div>
                    <div style="font-size: 32px; font-weight: 800; color: #3b82f6;">${opennessScore}/4</div>
                    <div style="font-size: 13px; color: #6b7280; margin-top: 8px;">${escapeHtml(trans.openMindednessScore)}</div>
                  </div>
                </td>
              </tr>
              ` : ''}
              
              <!-- Questions & Answers Section -->
              <tr>
                <td style="padding: 32px 40px 0 40px;">
                  <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 20px 0; font-weight: 700;">
                    📚 ${escapeHtml(trans.keyLearnings)}
                  </h2>
                  ${questionsHtml}
                </td>
              </tr>
              
              <!-- CTA -->
              <tr>
                <td style="padding: 16px 40px 40px 40px;">
                  <div style="background: linear-gradient(135deg, #f3e8ff, #ede9fe); border-radius: 16px; padding: 32px; text-align: center; border: 1px solid #e9d5ff;">
                    <h3 style="color: #6d28d9; font-size: 20px; margin: 0 0 12px 0; font-weight: 600;">${escapeHtml(dynamicCta.ctaTitle || trans.readyToLearnMore)}</h3>
                    <p style="color: #7c3aed; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">${escapeHtml(dynamicCta.ctaDescription || trans.ctaDescription)}</p>
                    <div style="display: inline-block;">
                      <a href="${dynamicCta.ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">${escapeHtml(dynamicCta.ctaButtonText || trans.visitSparkly)}</a>
                      ${dynamicCta.ctaRetryText ? `<a href="${dynamicCta.ctaRetryUrl}" style="display: inline-block; background: transparent; border: 2px solid #6d28d9; color: #6d28d9; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-left: 12px;">${escapeHtml(dynamicCta.ctaRetryText)}</a>` : ''}
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: HypothesisUserEmailRequest = await req.json();
    const { email, score, totalQuestions, quizId, quizTitle, language, sessionId, leadId, opennessScore } = body;

    console.log("Sending hypothesis user email to:", email);

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

    // Check for duplicate - skip if user email already sent/queued for this lead
    // Check both old "hypothesis_results" and new standardized "Quiz Taker" types
    if (leadId) {
      const { data: existingEmail } = await supabase
        .from("email_queue")
        .select("id")
        .eq("hypothesis_lead_id", leadId)
        .in("email_type", ["hypothesis_results", "Quiz Taker"])
        .in("status", ["pending", "processing", "sent"])
        .limit(1)
        .maybeSingle();

      if (existingEmail) {
        console.log("User email already queued/sent for lead:", leadId);
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "duplicate" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Also check email_logs
      const { data: existingLog } = await supabase
        .from("email_logs")
        .select("id")
        .eq("hypothesis_lead_id", leadId)
        .in("email_type", ["hypothesis_results", "Quiz Taker"])
        .limit(1)
        .maybeSingle();

      if (existingLog) {
        console.log("User email already logged for lead:", leadId);
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "duplicate" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const emailConfig = await getEmailConfig(supabase);
    const trans = emailTranslations[language] || emailTranslations['en'];

    // Fetch dynamic CTA content (matching send-quiz-results pattern)
    const dynamicCta = await fetchDynamicCtaContent(supabase, quizId, language);

    // Fetch all questions for this quiz (via pages)
    const { data: pages } = await supabase
      .from('hypothesis_pages')
      .select('id')
      .eq('quiz_id', quizId);

    const pageIds = pages?.map(p => p.id) || [];

    const { data: questions, error: questionsError } = await supabase
      .from('hypothesis_questions')
      .select('*')
      .in('page_id', pageIds)
      .order('question_order');

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      throw new Error('Failed to fetch questions');
    }

    // Fetch user responses for this session
    const { data: responses, error: responsesError } = await supabase
      .from('hypothesis_responses')
      .select('question_id, answer_man, answer_woman')
      .eq('session_id', sessionId)
      .eq('quiz_id', quizId);

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
      throw new Error('Failed to fetch responses');
    }

    // Fetch dynamic result level from database
    const dynamicResultLevel = await fetchHypothesisResultLevel(supabase, quizId, score, language);

    // Build email HTML with dynamic CTA and result level
    const htmlBody = buildEmailHtml(
      trans,
      language,
      score,
      totalQuestions,
      questions || [],
      responses || [],
      dynamicCta,
      dynamicResultLevel,
      opennessScore
    );

    // Use quiz-specific subject if available
    const emailQuizTitle = dynamicCta.quizTitle || trans.subject;
    const subject = `${emailQuizTitle} - ${score}/${totalQuestions}`;

    // Queue the email (will be sent by process-email-queue)
    // Using standardized email_type "Quiz Taker" per system requirements
    const { error: queueError } = await supabase.from("email_queue").insert({
      recipient_email: email,
      sender_email: emailConfig.senderEmail,
      sender_name: emailConfig.senderName,
      subject: subject,
      html_body: htmlBody,
      email_type: "Quiz Taker",
      hypothesis_lead_id: leadId || null,
      quiz_id: quizId || null,
      language: language,
      reply_to_email: emailConfig.replyToEmail || null,
    });

    if (queueError) {
      console.error("Error queuing email:", queueError);
      return new Response(JSON.stringify({ error: "Failed to queue email" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Hypothesis user email queued successfully");

    // Store email content on the lead record for instant preview access
    if (leadId) {
      const { error: updateLeadError } = await supabase
        .from("hypothesis_leads")
        .update({ email_html: htmlBody, email_subject: subject })
        .eq("id", leadId);

      if (updateLeadError) {
        console.error("Error updating lead with email content:", updateLeadError);
      } else {
        console.log("Lead updated with email content for instant preview");
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-hypothesis-user-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
