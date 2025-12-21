import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000; // 1 second

// Helper function to delay execution
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Send email with exponential backoff retry
async function sendEmailWithRetry(
  emailParams: {
    from: string;
    to: string[];
    subject: string;
    html: string;
  }
): Promise<{ data: { id: string } | null; error: { message: string } | null; attempts: number }> {
  let lastError: { message: string } | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`Email send attempt ${attempt}/${MAX_RETRIES} to: ${emailParams.to.join(", ")}`);
    
    const response = await resend.emails.send(emailParams);
    
    if (!response.error) {
      console.log(`Email sent successfully on attempt ${attempt}`);
      return { data: response.data, error: null, attempts: attempt };
    }
    
    lastError = response.error;
    console.error(`Email send attempt ${attempt} failed:`, response.error.message);
    
    // Don't delay after the last attempt
    if (attempt < MAX_RETRIES) {
      const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
      console.log(`Waiting ${delayMs}ms before retry...`);
      await delay(delayMs);
    }
  }
  
  console.error(`All ${MAX_RETRIES} email attempts failed`);
  return { data: null, error: lastError, attempts: MAX_RETRIES };
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
    wantToImprove: 'Ready for Precise Employee Assessment?',
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
    visitSparkly: 'Weiter zu Sparkly.hr',
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
    wantToImprove: 'Prêt pour une évaluation précise des employés?',
    visitSparkly: 'Continuer vers Sparkly.hr',
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
    wantToImprove: '¿Listo para una evaluación precisa de empleados?',
    visitSparkly: 'Continuar a Sparkly.hr',
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
    wantToImprove: 'Pronto per una valutazione precisa dei dipendenti?',
    visitSparkly: 'Continua su Sparkly.hr',
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
    wantToImprove: 'Pronto para uma avaliação precisa de funcionários?',
    visitSparkly: 'Continuar para Sparkly.hr',
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
    wantToImprove: 'Klaar voor nauwkeurige werknemersbeoordeling?',
    visitSparkly: 'Doorgaan naar Sparkly.hr',
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
    wantToImprove: 'Gotowy na precyzyjną ocenę pracowników?',
    visitSparkly: 'Przejdź do Sparkly.hr',
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
    wantToImprove: 'Готовы к точной оценке сотрудников?',
    visitSparkly: 'Перейти на Sparkly.hr',
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
    wantToImprove: 'Redo för en exakt medarbetarbedömning?',
    visitSparkly: 'Fortsätt till Sparkly.hr',
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
    wantToImprove: 'Klar for nøyaktig medarbeidervurdering?',
    visitSparkly: 'Fortsett til Sparkly.hr',
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
    wantToImprove: 'Klar til præcis medarbejdervurdering?',
    visitSparkly: 'Fortsæt til Sparkly.hr',
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
    wantToImprove: 'Valmis tarkkaan työntekijäarviointiin?',
    visitSparkly: 'Jatka Sparkly.hr-sivustolle',
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
    wantToImprove: 'Готові до точної оцінки співробітників?',
    visitSparkly: 'Перейти до Sparkly.hr',
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
  opennessMaxScore?: number;
  opennessTitle?: string;
  opennessDescription?: string;
  quizId?: string;
  quizSlug?: string;
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
      isTest = false 
    }: QuizResultsRequest & { isTest?: boolean } = await req.json();

    console.log("Processing quiz results for:", email);
    console.log("Score:", totalScore, "/", maxScore);
    console.log("Openness Score:", opennessScore, "/", opennessMaxScore);
    console.log("Openness Title:", opennessTitle);
    console.log("Quiz ID:", quizId);
    console.log("Language:", language);
    console.log("Is Test Email:", isTest);
    console.log(`Rate limit - Remaining requests: ${rateLimitResult.remainingRequests}`);

    // Get translations for the language
    const trans = emailTranslations[language] || emailTranslations.en;

    // Save lead to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch live email template configuration
    // First try quiz-specific template, then fall back to global template
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
    
    // Fall back to global template if no quiz-specific template found
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
      console.log("Using global email template");
    }
    // Use template values or fallback to defaults - ensure no undefined/null values
    const senderName = (templateData?.sender_name && templateData.sender_name.trim()) || "Sparkly.hr";
    const senderEmail = (templateData?.sender_email && templateData.sender_email.trim()) || "support@sparkly.hr";
    const templateSubjects = templateData?.subjects as Record<string, string> || {};
    const emailSubject = templateSubjects[language] || trans.subject;

    console.log("Using email config:", { senderName, senderEmail, subject: emailSubject });

    let quizLeadId: string | null = null;

    // Only save to database if not a test email
    if (!isTest) {
      const { data: insertedLead, error: insertError } = await supabase.from("quiz_leads").insert({
        email,
        score: totalScore,
        total_questions: maxScore,
        result_category: resultTitle,
        answers: answers || null,
        openness_score: opennessScore ?? null,
        language: language,
      }).select("id").single();

      if (insertError) {
        console.error("Error saving lead to database:", insertError);
      } else {
        console.log("Lead saved to database successfully");
        quizLeadId = insertedLead?.id || null;
      }
    } else {
      console.log("Test email - skipping database save");
    }

    // Sanitize user-provided content to prevent HTML injection
    const safeResultTitle = escapeHtml(resultTitle);
    const safeResultDescription = escapeHtml(resultDescription);
    const safeEmail = escapeHtml(email);
    const safeInsights = insights.map(insight => escapeHtml(insight));

    const insightsList = safeInsights.map((insight, i) => `<li style="margin-bottom: 8px;">${i + 1}. ${insight}</li>`).join("");

    // Sparkly.hr logo URL - hosted on sparkly.hr
    const logoUrl = "https://sparkly.hr/wp-content/uploads/2025/06/sparkly-logo.png";

    // Build openness score section if available - now with title and description
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

    // Leadership Assessment Module - How answers are scored
    const assessmentModuleTranslations: Record<string, {
      howWeAssess: string;
      scoringExplained: string;
      delegationTitle: string;
      delegationDesc: string;
      deadlinesTitle: string;
      deadlinesDesc: string;
      communicationTitle: string;
      communicationDesc: string;
      scoreRange: string;
      highScore: string;
      lowScore: string;
    }> = {
      en: {
        howWeAssess: 'How We Assess Leadership Performance',
        scoringExplained: 'Your score reflects real operational patterns that impact business growth',
        delegationTitle: 'Delegation Effectiveness',
        delegationDesc: 'Leaders who rarely redo delegated work have built trust and clear expectations with their teams.',
        deadlinesTitle: 'Deadline Management',
        deadlinesDesc: 'Consistent deadline adherence signals strong team accountability and realistic planning.',
        communicationTitle: 'Communication Clarity',
        communicationDesc: 'Clear communication reduces rework, misunderstandings, and operational friction.',
        scoreRange: 'Score Range',
        highScore: 'High performers (4 pts): Demonstrate autonomy, accountability, and proactive ownership.',
        lowScore: 'Growth areas (1-2 pts): Indicate opportunities for improved delegation, clarity, or team development.',
      },
      et: {
        howWeAssess: 'Kuidas me hindame juhtimise tulemuslikkust',
        scoringExplained: 'Sinu tulemus peegeldab tegelikke operatiivseid mustreid, mis mõjutavad äri kasvu',
        delegationTitle: 'Delegeerimise efektiivsus',
        delegationDesc: 'Juhid, kes harva teevad delegeeritud tööd ümber, on loonud usalduse ja selged ootused oma meeskondadega.',
        deadlinesTitle: 'Tähtaegade haldamine',
        deadlinesDesc: 'Järjepidev tähtaegadest kinnipidamine näitab tugevat meeskonna vastutust ja realistlikku planeerimist.',
        communicationTitle: 'Suhtluse selgus',
        communicationDesc: 'Selge suhtlus vähendab ümbertöötlemist, arusaamatusi ja operatiivset hõõrdumist.',
        scoreRange: 'Punktide vahemik',
        highScore: 'Kõrge tulemuslikkus (4 p): Demonstreerivad autonoomiat, vastutust ja proaktiivset omanikutunnet.',
        lowScore: 'Kasvualad (1-2 p): Näitavad võimalusi paremaks delegeerimiseks, selguseks või meeskonna arendamiseks.',
      },
      de: {
        howWeAssess: 'Wie wir Führungsleistung bewerten',
        scoringExplained: 'Ihr Ergebnis spiegelt reale operative Muster wider, die das Geschäftswachstum beeinflussen',
        delegationTitle: 'Delegationseffektivität',
        delegationDesc: 'Führungskräfte, die delegierte Arbeit selten wiederholen, haben Vertrauen und klare Erwartungen mit ihren Teams aufgebaut.',
        deadlinesTitle: 'Fristmanagement',
        deadlinesDesc: 'Konstante Fristeneinhaltung signalisiert starke Teamverantwortung und realistische Planung.',
        communicationTitle: 'Kommunikationsklarheit',
        communicationDesc: 'Klare Kommunikation reduziert Nacharbeit, Missverständnisse und operativen Reibungsverlust.',
        scoreRange: 'Punktebereich',
        highScore: 'Hochleister (4 Pkt): Demonstrieren Autonomie, Verantwortung und proaktive Eigenverantwortung.',
        lowScore: 'Wachstumsbereiche (1-2 Pkt): Zeigen Möglichkeiten für verbesserte Delegation, Klarheit oder Teamentwicklung.',
      },
    };

    const assessTrans = assessmentModuleTranslations[language] || assessmentModuleTranslations.en;

    // Build assessment module section
    const assessmentModule = `
          <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
            <h3 style="color: #1e293b; font-size: 16px; margin: 0 0 8px 0; font-weight: 600;">📊 ${escapeHtml(assessTrans.howWeAssess)}</h3>
            <p style="color: #64748b; font-size: 13px; margin: 0 0 16px 0; line-height: 1.5;">${escapeHtml(assessTrans.scoringExplained)}</p>
            
            <div style="display: grid; gap: 12px;">
              <div style="background: white; border-radius: 8px; padding: 12px; border-left: 3px solid #6d28d9;">
                <p style="color: #1e293b; font-size: 13px; font-weight: 600; margin: 0 0 4px 0;">🎯 ${escapeHtml(assessTrans.delegationTitle)}</p>
                <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.4;">${escapeHtml(assessTrans.delegationDesc)}</p>
              </div>
              <div style="background: white; border-radius: 8px; padding: 12px; border-left: 3px solid #7c3aed;">
                <p style="color: #1e293b; font-size: 13px; font-weight: 600; margin: 0 0 4px 0;">⏰ ${escapeHtml(assessTrans.deadlinesTitle)}</p>
                <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.4;">${escapeHtml(assessTrans.deadlinesDesc)}</p>
              </div>
              <div style="background: white; border-radius: 8px; padding: 12px; border-left: 3px solid #8b5cf6;">
                <p style="color: #1e293b; font-size: 13px; font-weight: 600; margin: 0 0 4px 0;">💬 ${escapeHtml(assessTrans.communicationTitle)}</p>
                <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.4;">${escapeHtml(assessTrans.communicationDesc)}</p>
              </div>
            </div>
            
            <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
              <p style="color: #1e293b; font-size: 12px; font-weight: 600; margin: 0 0 6px 0;">${escapeHtml(assessTrans.scoreRange)}:</p>
              <p style="color: #22c55e; font-size: 11px; margin: 0 0 4px 0;">✓ ${escapeHtml(assessTrans.highScore)}</p>
              <p style="color: #f59e0b; font-size: 11px; margin: 0;">→ ${escapeHtml(assessTrans.lowScore)}</p>
            </div>
          </div>
    `;

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
          
          ${assessmentModule}
          
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

    // Send to user with dynamic sender config and retry logic
    console.log("Attempting to send user email to:", email);
    const userEmailSubject = `${emailSubject}: ${safeResultTitle}`;
    const userEmailResponse = await sendEmailWithRetry({
      from: `${senderName} <${senderEmail}>`,
      to: [email],
      subject: userEmailSubject,
      html: emailHtml,
    });

    console.log("User email response:", JSON.stringify(userEmailResponse));
    
    // Log user email to database with attempt count and HTML body
    await supabase.from("email_logs").insert({
      email_type: isTest ? "test" : "quiz_result_user",
      recipient_email: email,
      sender_email: senderEmail,
      sender_name: senderName,
      subject: userEmailSubject,
      status: userEmailResponse.error ? "failed" : "sent",
      resend_id: userEmailResponse.data?.id || null,
      error_message: userEmailResponse.error?.message || null,
      language: language,
      quiz_lead_id: quizLeadId,
      resend_attempts: userEmailResponse.attempts - 1,
      last_attempt_at: new Date().toISOString(),
      html_body: emailHtml,
    });
    
    if (userEmailResponse.error) {
      console.error("Resend user email error after all retries:", userEmailResponse.error);
    }

    // Skip admin notification for test emails
    if (isTest) {
      console.log("Test email - skipping admin notification");
      return new Response(JSON.stringify({ success: true, isTest: true }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": rateLimitResult.remainingRequests.toString(),
          "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
          ...corsHeaders 
        },
      });
    }

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
    const adminEmailResponse = await sendEmailWithRetry({
      from: `${senderName} Quiz <${senderEmail}>`,
      to: ["mikk@sparkly.hr"],
      subject: adminEmailSubject,
      html: adminEmailHtml,
    });

    console.log("Admin email response:", JSON.stringify(adminEmailResponse));

    // Log admin email to database with attempt count and HTML body
    await supabase.from("email_logs").insert({
      email_type: "quiz_result_admin",
      recipient_email: "mikk@sparkly.hr",
      sender_email: senderEmail,
      sender_name: senderName,
      subject: adminEmailSubject,
      status: adminEmailResponse.error ? "failed" : "sent",
      resend_id: adminEmailResponse.data?.id || null,
      error_message: adminEmailResponse.error?.message || null,
      language: language,
      quiz_lead_id: quizLeadId,
      resend_attempts: adminEmailResponse.attempts - 1,
      last_attempt_at: new Date().toISOString(),
      html_body: adminEmailHtml,
    });
    
    if (adminEmailResponse.error) {
      console.error("Resend admin email error after all retries:", adminEmailResponse.error);
    }

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
