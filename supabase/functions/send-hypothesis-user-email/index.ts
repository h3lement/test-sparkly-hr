import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

// Translations for hypothesis quiz emails
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
}

function buildEmailHtml(
  trans: typeof emailTranslations['en'],
  language: string,
  score: number,
  totalQuestions: number,
  questions: QuestionData[],
  responses: ResponseData[],
  ctaUrl: string
): string {
  const logoUrl = "https://sparkly.hr/wp-content/uploads/2025/06/sparkly-logo.png";
  const percentage = Math.round((score / totalQuestions) * 100);
  
  // Get assessment category based on percentage
  const getAssessment = () => {
    if (percentage >= 90) return { label: "Bias Champion", emoji: "🏆", color: "#10b981" };
    if (percentage >= 70) return { label: "Bias Aware", emoji: "⭐", color: "#3b82f6" };
    if (percentage >= 50) return { label: "Bias Curious", emoji: "📚", color: "#f59e0b" };
    if (percentage >= 30) return { label: "Bias Discoverer", emoji: "🌱", color: "#f97316" };
    return { label: "Bias Explorer", emoji: "🔍", color: "#ef4444" };
  };
  
  const assessment = getAssessment();

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
                    <h3 style="color: #6d28d9; font-size: 20px; margin: 0 0 12px 0; font-weight: 600;">${escapeHtml(trans.readyToLearnMore)}</h3>
                    <p style="color: #7c3aed; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">${escapeHtml(trans.ctaDescription)}</p>
                    <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">${escapeHtml(trans.visitSparkly)}</a>
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
    const { email, score, totalQuestions, quizId, quizTitle, language, sessionId, leadId } = body;

    console.log("Sending hypothesis user email to:", email);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const emailConfig = await getEmailConfig(supabase);
    const trans = emailTranslations[language] || emailTranslations['en'];

    // Fetch quiz CTA URL
    const { data: quiz } = await supabase
      .from('quizzes')
      .select('cta_url')
      .eq('id', quizId)
      .single();
    
    const ctaUrl = quiz?.cta_url || 'https://sparkly.hr';

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

    // Build email HTML
    const htmlBody = buildEmailHtml(
      trans,
      language,
      score,
      totalQuestions,
      questions || [],
      responses || [],
      ctaUrl
    );

    const subject = `${trans.subject} - ${score}/${totalQuestions}`;

    // Queue the email
    const { error: queueError } = await supabase.from("email_queue").insert({
      recipient_email: email,
      sender_email: emailConfig.senderEmail,
      sender_name: emailConfig.senderName,
      subject: subject,
      html_body: htmlBody,
      email_type: "hypothesis_results",
      quiz_lead_id: leadId || null,
      quiz_id: quizId || null,
      language: language,
      reply_to_email: emailConfig.replyToEmail || null,
    });

    if (queueError) {
      console.error("Error queuing user email:", queueError);
      return new Response(JSON.stringify({ error: "Failed to queue email" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Also log the email
    await supabase.from("email_logs").insert({
      recipient_email: email,
      sender_email: emailConfig.senderEmail,
      sender_name: emailConfig.senderName,
      subject: subject,
      html_body: htmlBody,
      email_type: "hypothesis_results",
      quiz_lead_id: leadId || null,
      quiz_id: quizId || null,
      language: language,
      status: "queued",
    });

    console.log("Hypothesis user email queued successfully");

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
