import { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'et' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'nl' | 'pl' | 'ru' | 'zh' | 'ja' | 'ko' | 'ar' | 'hi' | 'sv' | 'no' | 'da' | 'fi';

interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
}

export const languages: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
];

type TranslationKey = 
  | 'badge'
  | 'headline'
  | 'headlineHighlight'
  | 'description'
  | 'discoverTitle'
  | 'discover1'
  | 'discover2'
  | 'discover3'
  | 'startButton'
  | 'learnMore'
  | 'duration'
  | 'selectLanguage';

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    badge: 'Backed by decades of HR Experience and Deep Research',
    headline: 'Is Your Team Holding You',
    headlineHighlight: 'Back?',
    description: 'Take this 2-minute assessment to discover if employee performance issues are secretly draining your time, energy, and business growth.',
    discoverTitle: "What you'll discover:",
    discover1: 'Your team performance score (and what it means)',
    discover2: 'Hidden signs of performance problems',
    discover3: 'Actionable next steps tailored to your situation',
    startButton: 'Start Free Assessment',
    learnMore: 'Learn More',
    duration: 'Takes only 2 minutes • 100% confidential',
    selectLanguage: 'Select Language',
  },
  et: {
    badge: 'Toetatud aastakümnete pikkuse personalijuhtimise kogemuse ja süvitsi minevate uuringutega',
    headline: 'Kas Sinu meeskond hoiab Sind',
    headlineHighlight: 'tagasi?',
    description: 'Tee see 2-minutiline hindamine, et avastada, kas töötajate tulemuslikkuse probleemid kurnavad salaja sinu aega, energiat ja äri kasvu.',
    discoverTitle: 'Mida sa avastad:',
    discover1: 'Sinu meeskonna tulemuslikkuse skoor (ja mida see tähendab)',
    discover2: 'Peidetud märgid tulemuslikkuse probleemidest',
    discover3: 'Konkreetsed järgmised sammud, mis on kohandatud sinu olukorrale',
    startButton: 'Alusta tasuta hindamist',
    learnMore: 'Loe rohkem',
    duration: 'Kestab vaid 2 minutit • 100% konfidentsiaalne',
    selectLanguage: 'Vali keel',
  },
  de: {
    badge: 'Gestützt auf jahrzehntelange HR-Erfahrung und tiefgreifende Forschung',
    headline: 'Hält Ihr Team Sie',
    headlineHighlight: 'zurück?',
    description: 'Machen Sie diese 2-minütige Bewertung, um herauszufinden, ob Leistungsprobleme Ihrer Mitarbeiter heimlich Ihre Zeit, Energie und Ihr Geschäftswachstum aufzehren.',
    discoverTitle: 'Was Sie entdecken werden:',
    discover1: 'Ihren Team-Leistungswert (und was er bedeutet)',
    discover2: 'Versteckte Anzeichen für Leistungsprobleme',
    discover3: 'Umsetzbare nächste Schritte für Ihre Situation',
    startButton: 'Kostenlose Bewertung starten',
    learnMore: 'Mehr erfahren',
    duration: 'Dauert nur 2 Minuten • 100% vertraulich',
    selectLanguage: 'Sprache wählen',
  },
  fr: {
    badge: "Soutenu par des décennies d'expérience RH et de recherche approfondie",
    headline: 'Votre équipe vous',
    headlineHighlight: 'freine-t-elle?',
    description: 'Faites cette évaluation de 2 minutes pour découvrir si les problèmes de performance des employés drainent secrètement votre temps, votre énergie et la croissance de votre entreprise.',
    discoverTitle: 'Ce que vous découvrirez:',
    discover1: 'Le score de performance de votre équipe (et ce que cela signifie)',
    discover2: 'Les signes cachés de problèmes de performance',
    discover3: 'Des prochaines étapes concrètes adaptées à votre situation',
    startButton: 'Commencer l\'évaluation gratuite',
    learnMore: 'En savoir plus',
    duration: 'Ne prend que 2 minutes • 100% confidentiel',
    selectLanguage: 'Choisir la langue',
  },
  es: {
    badge: 'Respaldado por décadas de experiencia en RRHH e investigación profunda',
    headline: '¿Tu equipo te está',
    headlineHighlight: 'frenando?',
    description: 'Realiza esta evaluación de 2 minutos para descubrir si los problemas de rendimiento de los empleados están drenando secretamente tu tiempo, energía y crecimiento empresarial.',
    discoverTitle: 'Lo que descubrirás:',
    discover1: 'La puntuación de rendimiento de tu equipo (y qué significa)',
    discover2: 'Señales ocultas de problemas de rendimiento',
    discover3: 'Próximos pasos accionables adaptados a tu situación',
    startButton: 'Iniciar evaluación gratuita',
    learnMore: 'Más información',
    duration: 'Solo toma 2 minutos • 100% confidencial',
    selectLanguage: 'Seleccionar idioma',
  },
  it: {
    badge: 'Supportato da decenni di esperienza HR e ricerca approfondita',
    headline: 'Il tuo team ti sta',
    headlineHighlight: 'trattenendo?',
    description: 'Fai questa valutazione di 2 minuti per scoprire se i problemi di performance dei dipendenti stanno segretamente prosciugando il tuo tempo, energia e crescita aziendale.',
    discoverTitle: 'Cosa scoprirai:',
    discover1: 'Il punteggio di performance del tuo team (e cosa significa)',
    discover2: 'Segnali nascosti di problemi di performance',
    discover3: 'Prossimi passi concreti adattati alla tua situazione',
    startButton: 'Inizia valutazione gratuita',
    learnMore: 'Scopri di più',
    duration: 'Richiede solo 2 minuti • 100% confidenziale',
    selectLanguage: 'Seleziona lingua',
  },
  pt: {
    badge: 'Apoiado por décadas de experiência em RH e pesquisa aprofundada',
    headline: 'A sua equipa está a',
    headlineHighlight: 'travá-lo?',
    description: 'Faça esta avaliação de 2 minutos para descobrir se problemas de desempenho dos funcionários estão secretamente a drenar o seu tempo, energia e crescimento empresarial.',
    discoverTitle: 'O que vai descobrir:',
    discover1: 'A pontuação de desempenho da sua equipa (e o que significa)',
    discover2: 'Sinais ocultos de problemas de desempenho',
    discover3: 'Próximos passos acionáveis adaptados à sua situação',
    startButton: 'Iniciar avaliação gratuita',
    learnMore: 'Saber mais',
    duration: 'Leva apenas 2 minutos • 100% confidencial',
    selectLanguage: 'Selecionar idioma',
  },
  nl: {
    badge: 'Ondersteund door decennia HR-ervaring en diepgaand onderzoek',
    headline: 'Houdt uw team u',
    headlineHighlight: 'tegen?',
    description: 'Doe deze 2-minuten beoordeling om te ontdekken of prestatieproblemen van medewerkers in het geheim uw tijd, energie en bedrijfsgroei weglekken.',
    discoverTitle: 'Wat u zult ontdekken:',
    discover1: 'De prestatiescore van uw team (en wat het betekent)',
    discover2: 'Verborgen tekenen van prestatieproblemen',
    discover3: 'Actiegerichte volgende stappen afgestemd op uw situatie',
    startButton: 'Start gratis beoordeling',
    learnMore: 'Meer informatie',
    duration: 'Duurt slechts 2 minuten • 100% vertrouwelijk',
    selectLanguage: 'Selecteer taal',
  },
  pl: {
    badge: 'Poparty dziesięcioleciami doświadczenia HR i dogłębnymi badaniami',
    headline: 'Czy Twój zespół Cię',
    headlineHighlight: 'powstrzymuje?',
    description: 'Wykonaj tę 2-minutową ocenę, aby odkryć, czy problemy z wydajnością pracowników potajemnie wyczerpują Twój czas, energię i rozwój biznesu.',
    discoverTitle: 'Co odkryjesz:',
    discover1: 'Wynik wydajności Twojego zespołu (i co to oznacza)',
    discover2: 'Ukryte oznaki problemów z wydajnością',
    discover3: 'Konkretne następne kroki dostosowane do Twojej sytuacji',
    startButton: 'Rozpocznij bezpłatną ocenę',
    learnMore: 'Dowiedz się więcej',
    duration: 'Zajmuje tylko 2 minuty • 100% poufne',
    selectLanguage: 'Wybierz język',
  },
  ru: {
    badge: 'Подкреплено десятилетиями опыта в HR и глубокими исследованиями',
    headline: 'Ваша команда',
    headlineHighlight: 'сдерживает вас?',
    description: 'Пройдите эту 2-минутную оценку, чтобы узнать, не истощают ли проблемы с производительностью сотрудников втайне ваше время, энергию и рост бизнеса.',
    discoverTitle: 'Что вы узнаете:',
    discover1: 'Оценку производительности вашей команды (и что это значит)',
    discover2: 'Скрытые признаки проблем с производительностью',
    discover3: 'Практические следующие шаги, адаптированные к вашей ситуации',
    startButton: 'Начать бесплатную оценку',
    learnMore: 'Узнать больше',
    duration: 'Займет всего 2 минуты • 100% конфиденциально',
    selectLanguage: 'Выберите язык',
  },
  zh: {
    badge: '数十年人力资源经验和深度研究支持',
    headline: '您的团队是否在',
    headlineHighlight: '拖累您？',
    description: '进行这个2分钟的评估，了解员工绩效问题是否正在悄悄消耗您的时间、精力和业务增长。',
    discoverTitle: '您将发现：',
    discover1: '您团队的绩效评分（及其含义）',
    discover2: '绩效问题的隐藏迹象',
    discover3: '针对您情况的可操作下一步',
    startButton: '开始免费评估',
    learnMore: '了解更多',
    duration: '仅需2分钟 • 100%保密',
    selectLanguage: '选择语言',
  },
  ja: {
    badge: '数十年のHR経験と深い研究に裏打ちされています',
    headline: 'あなたのチームは',
    headlineHighlight: '足を引っ張っていますか？',
    description: 'この2分間の評価を受けて、従業員のパフォーマンス問題があなたの時間、エネルギー、ビジネスの成長を密かに奪っていないか確認してください。',
    discoverTitle: '発見できること：',
    discover1: 'チームのパフォーマンススコア（とその意味）',
    discover2: 'パフォーマンス問題の隠れた兆候',
    discover3: 'あなたの状況に合わせた実行可能な次のステップ',
    startButton: '無料評価を開始',
    learnMore: '詳細を見る',
    duration: 'わずか2分 • 100%機密',
    selectLanguage: '言語を選択',
  },
  ko: {
    badge: '수십 년의 HR 경험과 심층 연구를 바탕으로 합니다',
    headline: '당신의 팀이',
    headlineHighlight: '발목을 잡고 있나요?',
    description: '이 2분 평가를 통해 직원 성과 문제가 당신의 시간, 에너지, 비즈니스 성장을 몰래 빼앗고 있는지 확인하세요.',
    discoverTitle: '발견하게 될 것:',
    discover1: '팀의 성과 점수 (그것이 의미하는 바)',
    discover2: '성과 문제의 숨겨진 징후',
    discover3: '상황에 맞는 실행 가능한 다음 단계',
    startButton: '무료 평가 시작',
    learnMore: '더 알아보기',
    duration: '단 2분 소요 • 100% 기밀',
    selectLanguage: '언어 선택',
  },
  ar: {
    badge: 'مدعوم بعقود من الخبرة في الموارد البشرية والبحث المعمق',
    headline: 'هل فريقك',
    headlineHighlight: 'يعيقك؟',
    description: 'قم بهذا التقييم الذي يستغرق دقيقتين لاكتشاف ما إذا كانت مشاكل أداء الموظفين تستنزف وقتك وطاقتك ونمو عملك سرًا.',
    discoverTitle: 'ما ستكتشفه:',
    discover1: 'درجة أداء فريقك (وما تعنيه)',
    discover2: 'علامات خفية على مشاكل الأداء',
    discover3: 'خطوات تالية قابلة للتنفيذ مصممة لموقفك',
    startButton: 'ابدأ التقييم المجاني',
    learnMore: 'اعرف المزيد',
    duration: 'يستغرق دقيقتين فقط • سري 100%',
    selectLanguage: 'اختر اللغة',
  },
  hi: {
    badge: 'दशकों के एचआर अनुभव और गहन शोध द्वारा समर्थित',
    headline: 'क्या आपकी टीम आपको',
    headlineHighlight: 'रोक रही है?',
    description: 'यह 2-मिनट का आकलन करें और जानें कि क्या कर्मचारी प्रदर्शन की समस्याएं चुपचाप आपका समय, ऊर्जा और व्यावसायिक विकास खा रही हैं।',
    discoverTitle: 'आप क्या खोजेंगे:',
    discover1: 'आपकी टीम का प्रदर्शन स्कोर (और इसका क्या मतलब है)',
    discover2: 'प्रदर्शन समस्याओं के छिपे संकेत',
    discover3: 'आपकी स्थिति के अनुरूप कार्रवाई योग्य अगले कदम',
    startButton: 'मुफ्त आकलन शुरू करें',
    learnMore: 'और जानें',
    duration: 'केवल 2 मिनट लगते हैं • 100% गोपनीय',
    selectLanguage: 'भाषा चुनें',
  },
  sv: {
    badge: 'Stöds av decennier av HR-erfarenhet och djupgående forskning',
    headline: 'Håller ditt team dig',
    headlineHighlight: 'tillbaka?',
    description: 'Gör denna 2-minuters utvärdering för att upptäcka om anställdas prestationsproblem i hemlighet dränerar din tid, energi och företagstillväxt.',
    discoverTitle: 'Vad du kommer att upptäcka:',
    discover1: 'Ditt teams prestationspoäng (och vad det betyder)',
    discover2: 'Dolda tecken på prestationsproblem',
    discover3: 'Handlingsbara nästa steg anpassade till din situation',
    startButton: 'Starta gratis utvärdering',
    learnMore: 'Läs mer',
    duration: 'Tar bara 2 minuter • 100% konfidentiellt',
    selectLanguage: 'Välj språk',
  },
  no: {
    badge: 'Støttet av tiår med HR-erfaring og dyptgående forskning',
    headline: 'Holder teamet ditt deg',
    headlineHighlight: 'tilbake?',
    description: 'Ta denne 2-minutters vurderingen for å oppdage om ansattes ytelsesproblemer i hemmelighet tapper din tid, energi og forretningsvekst.',
    discoverTitle: 'Hva du vil oppdage:',
    discover1: 'Teamets ytelsesscore (og hva det betyr)',
    discover2: 'Skjulte tegn på ytelsesproblemer',
    discover3: 'Handlingsrettede neste skritt tilpasset din situasjon',
    startButton: 'Start gratis vurdering',
    learnMore: 'Lær mer',
    duration: 'Tar bare 2 minutter • 100% konfidensielt',
    selectLanguage: 'Velg språk',
  },
  da: {
    badge: 'Understøttet af årtiers HR-erfaring og dybdegående forskning',
    headline: 'Holder dit team dig',
    headlineHighlight: 'tilbage?',
    description: 'Tag denne 2-minutters vurdering for at opdage, om medarbejdernes præstationsproblemer i hemmelighed dræner din tid, energi og virksomhedsvækst.',
    discoverTitle: 'Hvad du vil opdage:',
    discover1: 'Dit teams præstationsscore (og hvad det betyder)',
    discover2: 'Skjulte tegn på præstationsproblemer',
    discover3: 'Handlingsrettede næste skridt tilpasset din situation',
    startButton: 'Start gratis vurdering',
    learnMore: 'Læs mere',
    duration: 'Tager kun 2 minutter • 100% fortroligt',
    selectLanguage: 'Vælg sprog',
  },
  fi: {
    badge: 'Vuosikymmenten HR-kokemuksen ja syvällisen tutkimuksen tukema',
    headline: 'Pidätteleekö tiimisi',
    headlineHighlight: 'sinua?',
    description: 'Tee tämä 2 minuutin arviointi selvittääksesi, kuluttavatko työntekijöiden suorituskykyongelmat salaa aikaasi, energiaasi ja liiketoimintasi kasvua.',
    discoverTitle: 'Mitä löydät:',
    discover1: 'Tiimisi suorituskykypisteet (ja mitä ne tarkoittavat)',
    discover2: 'Piilotettuja merkkejä suorituskykyongelmista',
    discover3: 'Toiminnalliset seuraavat askeleet tilanteesi mukaan',
    startButton: 'Aloita ilmainen arviointi',
    learnMore: 'Lue lisää',
    duration: 'Kestää vain 2 minuuttia • 100% luottamuksellinen',
    selectLanguage: 'Valitse kieli',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: TranslationKey): string => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
