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

// Email translations for all 24 supported languages
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
  fi: {
    subject: 'Tiimisi suorituskykytulokset',
    yourResults: 'Tiimisi suorituskykytulokset',
    outOf: '/',
    points: 'pisteestä',
    keyInsights: 'Keskeiset oivallukset',
    wantToImprove: 'Valmis tarkkaan työntekijäarviointiin?',
    ctaDescription: 'Tämä kysely antaa yleiskuvan. Tarkan ja perusteellisen analyysin sekä konkreettisten parannusstrategioiden saamiseksi jatka ammattimaiseen testaukseen.',
    visitSparkly: 'Jatka Sparkly.hr:ään',
    leadershipOpenMindedness: 'Avoin johtajuus',
    openMindednessOutOf: '/ 4',
  },
  sv: {
    subject: 'Ditt teams prestationsresultat',
    yourResults: 'Ditt teams prestationsresultat',
    outOf: 'av',
    points: 'poäng',
    keyInsights: 'Viktiga insikter',
    wantToImprove: 'Redo för exakt medarbetarbedömning?',
    ctaDescription: 'Detta quiz ger en allmän översikt. För noggrann, djupgående analys av ditt teams prestation och genomförbara förbättringsstrategier, fortsätt med professionell testning.',
    visitSparkly: 'Fortsätt till Sparkly.hr',
    leadershipOpenMindedness: 'Öppet ledarskap',
    openMindednessOutOf: 'av 4',
  },
  da: {
    subject: 'Dit teams præstationsresultater',
    yourResults: 'Dit teams præstationsresultater',
    outOf: 'ud af',
    points: 'point',
    keyInsights: 'Nøgleindsigter',
    wantToImprove: 'Klar til præcis medarbejdervurdering?',
    ctaDescription: 'Denne quiz giver et generelt overblik. For nøjagtig, dybdegående analyse af dit teams præstation og handlingsrettede forbedringsstrategier, fortsæt med professionel testning.',
    visitSparkly: 'Fortsæt til Sparkly.hr',
    leadershipOpenMindedness: 'Åbent lederskab',
    openMindednessOutOf: 'ud af 4',
  },
  nl: {
    subject: 'De prestatieresultaten van je team',
    yourResults: 'De prestatieresultaten van je team',
    outOf: 'van',
    points: 'punten',
    keyInsights: 'Belangrijke inzichten',
    wantToImprove: 'Klaar voor nauwkeurige medewerkersbeoordeling?',
    ctaDescription: 'Deze quiz geeft een algemeen overzicht. Voor nauwkeurige, diepgaande analyse van de prestaties van je team en uitvoerbare verbeterstrategieën, ga verder met professionele testen.',
    visitSparkly: 'Ga naar Sparkly.hr',
    leadershipOpenMindedness: 'Open leiderschap',
    openMindednessOutOf: 'van 4',
  },
  pl: {
    subject: 'Wyniki wydajności Twojego zespołu',
    yourResults: 'Wyniki wydajności Twojego zespołu',
    outOf: 'z',
    points: 'punktów',
    keyInsights: 'Kluczowe spostrzeżenia',
    wantToImprove: 'Gotowy na precyzyjną ocenę pracowników?',
    ctaDescription: 'Ten quiz daje ogólny przegląd. Aby uzyskać dokładną, dogłębną analizę wydajności zespołu i praktyczne strategie poprawy, przejdź do profesjonalnych testów.',
    visitSparkly: 'Przejdź do Sparkly.hr',
    leadershipOpenMindedness: 'Otwarte przywództwo',
    openMindednessOutOf: 'z 4',
  },
  fr: {
    subject: 'Les résultats de performance de votre équipe',
    yourResults: 'Les résultats de performance de votre équipe',
    outOf: 'sur',
    points: 'points',
    keyInsights: 'Points clés',
    wantToImprove: 'Prêt pour une évaluation précise des employés ?',
    ctaDescription: 'Ce quiz fournit un aperçu général. Pour une analyse approfondie et précise des performances de votre équipe et des stratégies d\'amélioration concrètes, continuez avec des tests professionnels.',
    visitSparkly: 'Continuer vers Sparkly.hr',
    leadershipOpenMindedness: 'Leadership ouvert',
    openMindednessOutOf: 'sur 4',
  },
  es: {
    subject: 'Resultados del rendimiento de tu equipo',
    yourResults: 'Resultados del rendimiento de tu equipo',
    outOf: 'de',
    points: 'puntos',
    keyInsights: 'Puntos clave',
    wantToImprove: '¿Listo para una evaluación precisa de empleados?',
    ctaDescription: 'Este cuestionario proporciona una visión general. Para un análisis preciso y profundo del rendimiento de tu equipo y estrategias de mejora prácticas, continúa con pruebas profesionales.',
    visitSparkly: 'Continuar a Sparkly.hr',
    leadershipOpenMindedness: 'Liderazgo abierto',
    openMindednessOutOf: 'de 4',
  },
  it: {
    subject: 'I risultati delle prestazioni del tuo team',
    yourResults: 'I risultati delle prestazioni del tuo team',
    outOf: 'su',
    points: 'punti',
    keyInsights: 'Punti chiave',
    wantToImprove: 'Pronto per una valutazione precisa dei dipendenti?',
    ctaDescription: 'Questo quiz fornisce una panoramica generale. Per un\'analisi accurata e approfondita delle prestazioni del tuo team e strategie di miglioramento attuabili, continua con i test professionali.',
    visitSparkly: 'Continua su Sparkly.hr',
    leadershipOpenMindedness: 'Leadership aperta',
    openMindednessOutOf: 'su 4',
  },
  pt: {
    subject: 'Resultados de desempenho da sua equipe',
    yourResults: 'Resultados de desempenho da sua equipe',
    outOf: 'de',
    points: 'pontos',
    keyInsights: 'Principais insights',
    wantToImprove: 'Pronto para uma avaliação precisa de funcionários?',
    ctaDescription: 'Este questionário fornece uma visão geral. Para uma análise precisa e aprofundada do desempenho da sua equipe e estratégias de melhoria práticas, continue com testes profissionais.',
    visitSparkly: 'Continuar para Sparkly.hr',
    leadershipOpenMindedness: 'Liderança aberta',
    openMindednessOutOf: 'de 4',
  },
  cs: {
    subject: 'Výsledky výkonu vašeho týmu',
    yourResults: 'Výsledky výkonu vašeho týmu',
    outOf: 'z',
    points: 'bodů',
    keyInsights: 'Klíčové poznatky',
    wantToImprove: 'Připraveni na přesné hodnocení zaměstnanců?',
    ctaDescription: 'Tento kvíz poskytuje obecný přehled. Pro přesnou, hloubkovou analýzu výkonu vašeho týmu a realizovatelné strategie zlepšení pokračujte profesionálním testováním.',
    visitSparkly: 'Pokračovat na Sparkly.hr',
    leadershipOpenMindedness: 'Otevřené vedení',
    openMindednessOutOf: 'ze 4',
  },
  hu: {
    subject: 'Csapatod teljesítményeredményei',
    yourResults: 'Csapatod teljesítményeredményei',
    outOf: '/',
    points: 'pontból',
    keyInsights: 'Kulcsfontosságú meglátások',
    wantToImprove: 'Készen áll a pontos alkalmazotti értékelésre?',
    ctaDescription: 'Ez a kvíz általános áttekintést nyújt. A csapatod teljesítményének pontos, mélyreható elemzéséhez és megvalósítható fejlesztési stratégiákhoz folytasd professzionális teszteléssel.',
    visitSparkly: 'Tovább a Sparkly.hr-re',
    leadershipOpenMindedness: 'Nyitott vezetés',
    openMindednessOutOf: '/ 4',
  },
  ro: {
    subject: 'Rezultatele performanței echipei tale',
    yourResults: 'Rezultatele performanței echipei tale',
    outOf: 'din',
    points: 'puncte',
    keyInsights: 'Perspective cheie',
    wantToImprove: 'Pregătit pentru evaluarea precisă a angajaților?',
    ctaDescription: 'Acest chestionar oferă o imagine de ansamblu. Pentru o analiză precisă și aprofundată a performanței echipei tale și strategii de îmbunătățire practice, continuă cu testarea profesională.',
    visitSparkly: 'Continuă la Sparkly.hr',
    leadershipOpenMindedness: 'Leadership deschis',
    openMindednessOutOf: 'din 4',
  },
  bg: {
    subject: 'Резултати от представянето на екипа ви',
    yourResults: 'Резултати от представянето на екипа ви',
    outOf: 'от',
    points: 'точки',
    keyInsights: 'Ключови прозрения',
    wantToImprove: 'Готови ли сте за прецизна оценка на служителите?',
    ctaDescription: 'Този тест предоставя общ преглед. За точен, задълбочен анализ на представянето на вашия екип и приложими стратегии за подобрение, продължете с професионално тестване.',
    visitSparkly: 'Продължете към Sparkly.hr',
    leadershipOpenMindedness: 'Отворено лидерство',
    openMindednessOutOf: 'от 4',
  },
  el: {
    subject: 'Αποτελέσματα απόδοσης της ομάδας σας',
    yourResults: 'Αποτελέσματα απόδοσης της ομάδας σας',
    outOf: 'από',
    points: 'βαθμούς',
    keyInsights: 'Βασικές πληροφορίες',
    wantToImprove: 'Έτοιμοι για ακριβή αξιολόγηση εργαζομένων;',
    ctaDescription: 'Αυτό το κουίζ παρέχει μια γενική επισκόπηση. Για ακριβή, εις βάθος ανάλυση της απόδοσης της ομάδας σας και εφαρμόσιμες στρατηγικές βελτίωσης, συνεχίστε με επαγγελματικές δοκιμές.',
    visitSparkly: 'Συνεχίστε στο Sparkly.hr',
    leadershipOpenMindedness: 'Ανοιχτή ηγεσία',
    openMindednessOutOf: 'από 4',
  },
  hr: {
    subject: 'Rezultati izvedbe vašeg tima',
    yourResults: 'Rezultati izvedbe vašeg tima',
    outOf: 'od',
    points: 'bodova',
    keyInsights: 'Ključni uvidi',
    wantToImprove: 'Spremni za preciznu procjenu zaposlenika?',
    ctaDescription: 'Ovaj kviz pruža opći pregled. Za točnu, dubinsku analizu izvedbe vašeg tima i provedive strategije poboljšanja, nastavite s profesionalnim testiranjem.',
    visitSparkly: 'Nastavi na Sparkly.hr',
    leadershipOpenMindedness: 'Otvoreno vodstvo',
    openMindednessOutOf: 'od 4',
  },
  sk: {
    subject: 'Výsledky výkonu vášho tímu',
    yourResults: 'Výsledky výkonu vášho tímu',
    outOf: 'z',
    points: 'bodov',
    keyInsights: 'Kľúčové poznatky',
    wantToImprove: 'Pripravení na presné hodnotenie zamestnancov?',
    ctaDescription: 'Tento kvíz poskytuje všeobecný prehľad. Pre presnú, hĺbkovú analýzu výkonu vášho tímu a realizovateľné stratégie zlepšenia pokračujte profesionálnym testovaním.',
    visitSparkly: 'Pokračovať na Sparkly.hr',
    leadershipOpenMindedness: 'Otvorené vedenie',
    openMindednessOutOf: 'zo 4',
  },
  sl: {
    subject: 'Rezultati uspešnosti vaše ekipe',
    yourResults: 'Rezultati uspešnosti vaše ekipe',
    outOf: 'od',
    points: 'točk',
    keyInsights: 'Ključni vpogledi',
    wantToImprove: 'Pripravljeni na natančno oceno zaposlenih?',
    ctaDescription: 'Ta kviz zagotavlja splošen pregled. Za natančno, poglobljeno analizo uspešnosti vaše ekipe in izvedljive strategije izboljšanja nadaljujte s profesionalnim testiranjem.',
    visitSparkly: 'Nadaljuj na Sparkly.hr',
    leadershipOpenMindedness: 'Odprto vodenje',
    openMindednessOutOf: 'od 4',
  },
  lt: {
    subject: 'Jūsų komandos veiklos rezultatai',
    yourResults: 'Jūsų komandos veiklos rezultatai',
    outOf: 'iš',
    points: 'taškų',
    keyInsights: 'Pagrindinės įžvalgos',
    wantToImprove: 'Pasiruošę tiksliam darbuotojų vertinimui?',
    ctaDescription: 'Šis klausimynas suteikia bendrą apžvalgą. Norėdami gauti tikslią, išsamią komandos veiklos analizę ir įgyvendinamas tobulinimo strategijas, tęskite profesionalų testavimą.',
    visitSparkly: 'Tęsti į Sparkly.hr',
    leadershipOpenMindedness: 'Atviras vadovavimas',
    openMindednessOutOf: 'iš 4',
  },
  lv: {
    subject: 'Jūsu komandas snieguma rezultāti',
    yourResults: 'Jūsu komandas snieguma rezultāti',
    outOf: 'no',
    points: 'punktiem',
    keyInsights: 'Galvenās atziņas',
    wantToImprove: 'Gatavs precīzai darbinieku novērtēšanai?',
    ctaDescription: 'Šis tests sniedz vispārīgu pārskatu. Lai iegūtu precīzu, padziļinātu komandas snieguma analīzi un īstenojamas uzlabošanas stratēģijas, turpiniet ar profesionālu testēšanu.',
    visitSparkly: 'Turpināt uz Sparkly.hr',
    leadershipOpenMindedness: 'Atvērta vadība',
    openMindednessOutOf: 'no 4',
  },
  mt: {
    subject: 'Ir-riżultati tal-prestazzjoni tat-tim tiegħek',
    yourResults: 'Ir-riżultati tal-prestazzjoni tat-tim tiegħek',
    outOf: 'minn',
    points: 'punti',
    keyInsights: 'Għarfien ewlieni',
    wantToImprove: 'Lest għal valutazzjoni preċiża tal-impjegati?',
    ctaDescription: 'Dan il-kwiżż jagħti ħarsa ġenerali. Għal analiżi preċiża u fil-fond tal-prestazzjoni tat-tim tiegħek u strateġiji ta\' titjib li jistgħu jiġu implimentati, kompli bit-testijiet professjonali.',
    visitSparkly: 'Kompli għal Sparkly.hr',
    leadershipOpenMindedness: 'Tmexxija miftuħa',
    openMindednessOutOf: 'minn 4',
  },
  ga: {
    subject: 'Torthaí feidhmíochta do fhoirne',
    yourResults: 'Torthaí feidhmíochta do fhoirne',
    outOf: 'as',
    points: 'pointe',
    keyInsights: 'Príomhléargais',
    wantToImprove: 'Réidh le haghaidh measúnú cruinn fostaithe?',
    ctaDescription: 'Tugann an tráth seo forbhreathnú ginearálta. Le haghaidh anailís chruinn, dhomhain ar fheidhmíocht d\'fhoirne agus straitéisí feabhsúcháin atá inchurtha i bhfeidhm, lean ar aghaidh le tástáil ghairmiúil.',
    visitSparkly: 'Lean ar aghaidh chuig Sparkly.hr',
    leadershipOpenMindedness: 'Ceannaireacht oscailte',
    openMindednessOutOf: 'as 4',
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
  ctaRetryText: string;
  ctaRetryUrl: string;
  quizSlug: string;
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
      ctaRetryText: getLocalizedValue(ctaSource.cta_retry_text, language, primaryLang, ''),
      ctaRetryUrl: ctaSource.cta_retry_url || '',
      quizSlug: quiz.slug || '',
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

// Build email HTML (same structure as render-email-preview but without preview banner)
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
  
  // Try Again button - use CTA retry text/url or fallback to quiz URL
  const retryTranslations: Record<string, string> = {
    en: 'Try Again',
    et: 'Proovi uuesti',
    de: 'Erneut versuchen',
    fi: 'Yritä uudelleen',
  };
  const retryButtonText = dynamicContent?.ctaRetryText || retryTranslations[language] || retryTranslations['en'];
  const quizSlug = dynamicContent?.quizSlug || '';
  const retryUrl = dynamicContent?.ctaRetryUrl || (quizSlug ? `https://quiz.sparkly.hr/${quizSlug}` : 'https://quiz.sparkly.hr');
  
  // Use the result title as header if dynamic content is available, otherwise fall back to generic translation
  const headerTitle = dynamicContent?.resultTitle ? `${resultEmoji} ${dynamicContent.resultTitle}` : trans.yourResults;
  
  const logoUrl = "https://sparkly.hr/wp-content/uploads/2025/06/sparkly-logo.png";
  const safeResultTitle = escapeHtml(finalResultTitle);
  const safeResultDescription = escapeHtml(finalResultDescription);
  const safeInsights = finalInsights.map(insight => escapeHtml(String(insight)));
  const safeOpennessTitle = opennessTitle ? escapeHtml(opennessTitle) : '';
  const safeOpennessDescription = opennessDescription ? escapeHtml(opennessDescription) : '';
  const safeCtaTitle = escapeHtml(finalCtaTitle);
  const safeCtaDescription = escapeHtml(finalCtaDescription);
  const safeCtaButtonText = escapeHtml(finalCtaButtonText);
  const safeRetryButtonText = escapeHtml(retryButtonText);
  
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

  // CTA section with Try Again button
  const ctaSection = (finalCtaTitle || finalCtaDescription) ? `
    <div style="background: linear-gradient(135deg, #f3e8ff, #ede9fe); border-radius: 16px; padding: 32px; margin-top: 28px; text-align: center; border: 1px solid #e9d5ff;">
      ${safeCtaTitle ? `<h3 style="color: #6d28d9; font-size: 20px; margin: 0 0 12px 0; font-weight: 600;">${safeCtaTitle}</h3>` : ''}
      ${safeCtaDescription ? `<p style="color: #7c3aed; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">${safeCtaDescription}</p>` : ''}
      <div style="display: inline-block;">
        <a href="${finalCtaUrl}" style="display: inline-block; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-right: 12px;">${safeCtaButtonText}</a>
        <a href="${retryUrl}" style="display: inline-block; background: transparent; color: #6d28d9; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; border: 2px solid #6d28d9;">${safeRetryButtonText}</a>
      </div>
    </div>
  ` : `
    <div style="text-align: center; margin-top: 28px;">
      <a href="${finalCtaUrl}" style="display: inline-block; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-right: 12px;">${safeCtaButtonText}</a>
      <a href="${retryUrl}" style="display: inline-block; background: transparent; color: #6d28d9; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; border: 2px solid #6d28d9;">${safeRetryButtonText}</a>
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
                  <h1 style="color: white; font-size: 26px; margin: 0; font-weight: 700;">${escapeHtml(headerTitle)}</h1>
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
    </body>
    </html>
  `;
}

interface PregenerateRequest {
  leadId: string;
  leadType: 'quiz' | 'hypothesis';
}

async function generateAndStoreEmailPreview(
  supabase: any,
  leadId: string,
  leadType: 'quiz' | 'hypothesis'
): Promise<{ success: boolean; error?: string }> {
  try {
    const table = leadType === 'quiz' ? 'quiz_leads' : 'hypothesis_leads';
    
    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from(table)
      .select('*')
      .eq('id', leadId)
      .single();
    
    if (leadError || !lead) {
      console.error(`Lead not found in ${table}:`, leadError?.message);
      return { success: false, error: `Lead not found: ${leadError?.message}` };
    }

    // Skip if already has email_html
    if (lead.email_html) {
      console.log(`Lead ${leadId} already has email_html, skipping`);
      return { success: true };
    }

    const quizId = lead.quiz_id;
    const score = lead.score;
    const totalQuestions = lead.total_questions;
    const opennessScore = lead.openness_score ?? undefined;
    const language = lead.language || 'en';

    if (!quizId) {
      return { success: false, error: 'Lead has no quiz_id' };
    }

    // Fetch quiz primary language
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

    // Update the lead with the generated HTML
    const { error: updateError } = await supabase
      .from(table)
      .update({ 
        email_html: html,
        email_subject: subject
      })
      .eq('id', leadId);

    if (updateError) {
      console.error(`Failed to update ${table} with email_html:`, updateError.message);
      return { success: false, error: updateError.message };
    }

    console.log(`Successfully pregenerated email for ${leadType} lead ${leadId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error in generateAndStoreEmailPreview:', error);
    return { success: false, error: error.message };
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log("pregenerate-email-preview function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    
    // Support single lead or batch processing
    if (body.leadId && body.leadType) {
      // Single lead mode
      const result = await generateAndStoreEmailPreview(supabase, body.leadId, body.leadType);
      return new Response(
        JSON.stringify(result),
        { status: result.success ? 200 : 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Batch mode: find leads without email_html and generate for them
    const limit = body.limit || 10;
    
    console.log(`Batch processing up to ${limit} leads without email_html`);
    
    // Fetch quiz leads without email_html
    const { data: quizLeads } = await supabase
      .from('quiz_leads')
      .select('id')
      .is('email_html', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Fetch hypothesis leads without email_html
    const { data: hypothesisLeads } = await supabase
      .from('hypothesis_leads')
      .select('id')
      .is('email_html', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    const results: { leadId: string; leadType: string; success: boolean; error?: string }[] = [];

    // Process quiz leads
    for (const lead of quizLeads || []) {
      const result = await generateAndStoreEmailPreview(supabase, lead.id, 'quiz');
      results.push({ leadId: lead.id, leadType: 'quiz', ...result });
    }

    // Process hypothesis leads
    for (const lead of hypothesisLeads || []) {
      const result = await generateAndStoreEmailPreview(supabase, lead.id, 'hypothesis');
      results.push({ leadId: lead.id, leadType: 'hypothesis', ...result });
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Batch complete: ${successCount}/${results.length} leads processed successfully`);

    return new Response(
      JSON.stringify({ 
        processed: results.length,
        successful: successCount,
        results 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in pregenerate-email-preview:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to pregenerate email preview" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
