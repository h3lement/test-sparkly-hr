import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 5; // 5 submissions per hour per IP

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIP(req: Request): string {
  // Try various headers that might contain the real IP
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; remainingRequests: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  // Clean up old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now - value.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window or expired entry
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { 
      allowed: true, 
      remainingRequests: MAX_REQUESTS_PER_WINDOW - 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    };
  }
  
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const resetTime = entry.windowStart + RATE_LIMIT_WINDOW_MS;
    return { 
      allowed: false, 
      remainingRequests: 0,
      resetTime
    };
  }
  
  // Increment counter
  entry.count++;
  rateLimitMap.set(ip, entry);
  
  return { 
    allowed: true, 
    remainingRequests: MAX_REQUESTS_PER_WINDOW - entry.count,
    resetTime: entry.windowStart + RATE_LIMIT_WINDOW_MS
  };
}

// Email translations
const emailTranslations: Record<string, {
  subject: string;
  yourResults: string;
  outOf: string;
  points: string;
  keyInsights: string;
  wantToImprove: string;
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
    wantToImprove: "Want to improve your team's performance?",
    visitSparkly: 'Visit Sparkly.hr',
    newQuizSubmission: 'New Quiz Submission',
    userEmail: 'User Email',
    score: 'Score',
    resultCategory: 'Result Category',
    leadershipOpenMindedness: 'Leadership Open-Mindedness',
    openMindednessOutOf: 'out of 4',
  },
  et: {
    subject: 'Sinu meeskonna tulemuslikkuse tulemused',
    yourResults: 'Sinu meeskonna tulemuslikkuse tulemused',
    outOf: 'punkti',
    points: 'punktist',
    keyInsights: 'Peamised tähelepanekud',
    wantToImprove: 'Soovid parandada oma meeskonna tulemuslikkust?',
    visitSparkly: 'Külasta Sparkly.hr',
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
    wantToImprove: 'Möchten Sie die Leistung Ihres Teams verbessern?',
    visitSparkly: 'Besuchen Sie Sparkly.hr',
    newQuizSubmission: 'Neue Quiz-Einreichung',
    userEmail: 'Benutzer-E-Mail',
    score: 'Punktzahl',
    resultCategory: 'Ergebniskategorie',
    leadershipOpenMindedness: 'Aufgeschlossene Führung',
    openMindednessOutOf: 'von 4',
  },
  fr: {
    subject: 'Vos résultats de performance d\'équipe',
    yourResults: 'Vos résultats de performance d\'équipe',
    outOf: 'sur',
    points: 'points',
    keyInsights: 'Points clés',
    wantToImprove: 'Voulez-vous améliorer la performance de votre équipe?',
    visitSparkly: 'Visitez Sparkly.hr',
    newQuizSubmission: 'Nouvelle soumission de quiz',
    userEmail: 'E-mail utilisateur',
    score: 'Score',
    resultCategory: 'Catégorie de résultat',
    leadershipOpenMindedness: 'Leadership ouvert d\'esprit',
    openMindednessOutOf: 'sur 4',
  },
  es: {
    subject: 'Tus resultados de rendimiento del equipo',
    yourResults: 'Tus resultados de rendimiento del equipo',
    outOf: 'de',
    points: 'puntos',
    keyInsights: 'Puntos clave',
    wantToImprove: '¿Quieres mejorar el rendimiento de tu equipo?',
    visitSparkly: 'Visita Sparkly.hr',
    newQuizSubmission: 'Nueva presentación de quiz',
    userEmail: 'Email del usuario',
    score: 'Puntuación',
    resultCategory: 'Categoría de resultado',
    leadershipOpenMindedness: 'Liderazgo de mente abierta',
    openMindednessOutOf: 'de 4',
  },
  it: {
    subject: 'I tuoi risultati di performance del team',
    yourResults: 'I tuoi risultati di performance del team',
    outOf: 'su',
    points: 'punti',
    keyInsights: 'Punti chiave',
    wantToImprove: 'Vuoi migliorare le prestazioni del tuo team?',
    visitSparkly: 'Visita Sparkly.hr',
    newQuizSubmission: 'Nuova sottomissione quiz',
    userEmail: 'Email utente',
    score: 'Punteggio',
    resultCategory: 'Categoria risultato',
    leadershipOpenMindedness: 'Leadership di mentalità aperta',
    openMindednessOutOf: 'su 4',
  },
  pt: {
    subject: 'Os seus resultados de desempenho da equipa',
    yourResults: 'Os seus resultados de desempenho da equipa',
    outOf: 'de',
    points: 'pontos',
    keyInsights: 'Pontos-chave',
    wantToImprove: 'Quer melhorar o desempenho da sua equipa?',
    visitSparkly: 'Visite Sparkly.hr',
    newQuizSubmission: 'Nova submissão de quiz',
    userEmail: 'Email do utilizador',
    score: 'Pontuação',
    resultCategory: 'Categoria do resultado',
    leadershipOpenMindedness: 'Liderança de mente aberta',
    openMindednessOutOf: 'de 4',
  },
  nl: {
    subject: 'Uw teamprestatie resultaten',
    yourResults: 'Uw teamprestatie resultaten',
    outOf: 'van',
    points: 'punten',
    keyInsights: 'Belangrijke inzichten',
    wantToImprove: 'Wilt u de prestaties van uw team verbeteren?',
    visitSparkly: 'Bezoek Sparkly.hr',
    newQuizSubmission: 'Nieuwe quiz inzending',
    userEmail: 'Gebruiker email',
    score: 'Score',
    resultCategory: 'Resultaat categorie',
    leadershipOpenMindedness: 'Open-minded leiderschap',
    openMindednessOutOf: 'van 4',
  },
  pl: {
    subject: 'Twoje wyniki wydajności zespołu',
    yourResults: 'Twoje wyniki wydajności zespołu',
    outOf: 'z',
    points: 'punktów',
    keyInsights: 'Kluczowe spostrzeżenia',
    wantToImprove: 'Chcesz poprawić wydajność swojego zespołu?',
    visitSparkly: 'Odwiedź Sparkly.hr',
    newQuizSubmission: 'Nowe zgłoszenie quizu',
    userEmail: 'Email użytkownika',
    score: 'Wynik',
    resultCategory: 'Kategoria wyniku',
    leadershipOpenMindedness: 'Przywództwo otwarte na innowacje',
    openMindednessOutOf: 'z 4',
  },
  ru: {
    subject: 'Результаты производительности вашей команды',
    yourResults: 'Результаты производительности вашей команды',
    outOf: 'из',
    points: 'баллов',
    keyInsights: 'Ключевые выводы',
    wantToImprove: 'Хотите улучшить производительность вашей команды?',
    visitSparkly: 'Посетите Sparkly.hr',
    newQuizSubmission: 'Новая отправка теста',
    userEmail: 'Email пользователя',
    score: 'Баллы',
    resultCategory: 'Категория результата',
    leadershipOpenMindedness: 'Открытое лидерство',
    openMindednessOutOf: 'из 4',
  },
  sv: {
    subject: 'Dina teamprestationsresultat',
    yourResults: 'Dina teamprestationsresultat',
    outOf: 'av',
    points: 'poäng',
    keyInsights: 'Viktiga insikter',
    wantToImprove: 'Vill du förbättra ditt teams prestation?',
    visitSparkly: 'Besök Sparkly.hr',
    newQuizSubmission: 'Ny quiz-inlämning',
    userEmail: 'Användaremail',
    score: 'Poäng',
    resultCategory: 'Resultatkategori',
    leadershipOpenMindedness: 'Öppensinnat ledarskap',
    openMindednessOutOf: 'av 4',
  },
  no: {
    subject: 'Dine teamytelsesresultater',
    yourResults: 'Dine teamytelsesresultater',
    outOf: 'av',
    points: 'poeng',
    keyInsights: 'Viktige innsikter',
    wantToImprove: 'Vil du forbedre teamets ytelse?',
    visitSparkly: 'Besøk Sparkly.hr',
    newQuizSubmission: 'Ny quiz-innsending',
    userEmail: 'Bruker-e-post',
    score: 'Poengsum',
    resultCategory: 'Resultatkategori',
    leadershipOpenMindedness: 'Åpent lederskap',
    openMindednessOutOf: 'av 4',
  },
  da: {
    subject: 'Dine teampræstationsresultater',
    yourResults: 'Dine teampræstationsresultater',
    outOf: 'af',
    points: 'point',
    keyInsights: 'Vigtige indsigter',
    wantToImprove: 'Vil du forbedre dit teams præstation?',
    visitSparkly: 'Besøg Sparkly.hr',
    newQuizSubmission: 'Ny quiz-indsendelse',
    userEmail: 'Bruger-email',
    score: 'Score',
    resultCategory: 'Resultatkategori',
    leadershipOpenMindedness: 'Åbensindet lederskab',
    openMindednessOutOf: 'af 4',
  },
  fi: {
    subject: 'Tiimisuorituksesi tulokset',
    yourResults: 'Tiimisuorituksesi tulokset',
    outOf: '/',
    points: 'pistettä',
    keyInsights: 'Keskeiset oivallukset',
    wantToImprove: 'Haluatko parantaa tiimisi suorituskykyä?',
    visitSparkly: 'Vieraile Sparkly.hr',
    newQuizSubmission: 'Uusi tietovisavastaus',
    userEmail: 'Käyttäjän sähköposti',
    score: 'Pisteet',
    resultCategory: 'Tuloskategoria',
    leadershipOpenMindedness: 'Avoimen mielen johtajuus',
    openMindednessOutOf: '/ 4',
  },
  uk: {
    subject: 'Результати продуктивності вашої команди',
    yourResults: 'Результати продуктивності вашої команди',
    outOf: 'з',
    points: 'балів',
    keyInsights: 'Ключові висновки',
    wantToImprove: 'Хочете покращити продуктивність вашої команди?',
    visitSparkly: 'Відвідайте Sparkly.hr',
    newQuizSubmission: 'Нове подання тесту',
    userEmail: 'Email користувача',
    score: 'Бали',
    resultCategory: 'Категорія результату',
    leadershipOpenMindedness: 'Відкрите лідерство',
    openMindednessOutOf: 'з 4',
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
  answers?: Array<{ questionId: number; selectedOption: number }>;
  opennessScore?: number;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-quiz-results function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIP = getClientIP(req);
  console.log("Client IP:", clientIP);
  
  const rateLimitResult = checkRateLimit(clientIP);
  
  if (!rateLimitResult.allowed) {
    const resetDate = new Date(rateLimitResult.resetTime);
    console.log(`Rate limit exceeded for IP: ${clientIP}. Reset at: ${resetDate.toISOString()}`);
    
    return new Response(
      JSON.stringify({ 
        error: "Too many requests. Please try again later.",
        resetTime: rateLimitResult.resetTime
      }),
      {
        status: 429,
        headers: { 
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
          ...corsHeaders 
        },
      }
    );
  }

  try {
    const { email, totalScore, maxScore, resultTitle, resultDescription, insights, language = 'en', answers, opennessScore }: QuizResultsRequest = await req.json();

    console.log("Processing quiz results for:", email);
    console.log("Score:", totalScore, "/", maxScore);
    console.log("Openness Score:", opennessScore);
    console.log("Language:", language);
    console.log(`Rate limit - Remaining requests: ${rateLimitResult.remainingRequests}`);

    // Get translations for the language
    const trans = emailTranslations[language] || emailTranslations.en;

    // Save lead to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: insertError } = await supabase.from("quiz_leads").insert({
      email,
      score: totalScore,
      total_questions: maxScore,
      result_category: resultTitle,
      answers: answers || null,
      openness_score: opennessScore ?? null,
      language: language,
    });

    if (insertError) {
      console.error("Error saving lead to database:", insertError);
    } else {
      console.log("Lead saved to database successfully");
    }

    // Sanitize user-provided content to prevent HTML injection
    const safeResultTitle = escapeHtml(resultTitle);
    const safeResultDescription = escapeHtml(resultDescription);
    const safeEmail = escapeHtml(email);
    const safeInsights = insights.map(insight => escapeHtml(insight));

    const insightsList = safeInsights.map((insight, i) => `<li style="margin-bottom: 8px;">${i + 1}. ${insight}</li>`).join("");

    // Sparkly.hr logo URL
    const logoUrl = "https://sparklyhr.app/favicon.png";

    // Build openness score section if available
    const opennessSection = opennessScore !== undefined && opennessScore !== null ? `
          <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <h3 style="color: #1f2937; font-size: 16px; margin: 0 0 12px 0;">${escapeHtml(trans.leadershipOpenMindedness)}</h3>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px; font-weight: bold; color: #6d28d9;">${opennessScore}</span>
              <span style="color: #6b7280;">${trans.openMindednessOutOf}</span>
            </div>
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
          
          <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 14px; margin-bottom: 12px;">${escapeHtml(trans.wantToImprove)}</p>
            <a href="https://sparkly.hr" style="display: inline-block; background: #6d28d9; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">${escapeHtml(trans.visitSparkly)}</a>
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

    // Send to user
    const userEmailResponse = await resend.emails.send({
      from: "Sparkly.hr <support@sparkly.hr>",
      to: [email],
      subject: `${trans.subject}: ${safeResultTitle}`,
      html: emailHtml,
    });

    console.log("User email sent:", userEmailResponse);

    // Send copy to admin (mikk@sparkly.hr) - always in English for consistency
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
            <p style="margin: 0 0 8px 0;"><strong>${adminTrans.leadershipOpenMindedness}:</strong> ${opennessScore !== undefined && opennessScore !== null ? `${opennessScore} / 4` : 'N/A'}</p>
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

    const adminEmailResponse = await resend.emails.send({
      from: "Sparkly.hr Quiz <support@sparkly.hr>",
      to: ["mikk@sparkly.hr"],
      subject: `New Quiz Lead: ${safeEmail} - ${safeResultTitle}`,
      html: adminEmailHtml,
    });

    console.log("Admin email sent:", adminEmailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": rateLimitResult.remainingRequests.toString(),
        "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
        ...corsHeaders 
      },
    });
  } catch (error: any) {
    console.error("Error in send-quiz-results:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
