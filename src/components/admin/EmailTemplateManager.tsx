import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Save, Check, Eye, Globe, Mail, Server } from "lucide-react";
import { EmailVersionHistory, WebVersionHistory } from "./VersionHistoryTables";
import { EmailPreviewDialog } from "./EmailPreviewDialog";
import { EmailSettings } from "./EmailSettings";
interface EmailTemplate {
  id: string;
  version_number: number;
  template_type: string;
  sender_name: string;
  sender_email: string;
  subjects: Record<string, string>;
  is_live: boolean;
  created_at: string;
  created_by_email: string | null;
  quiz_id: string | null;
}

interface EmailTemplateManagerProps {
  quizId?: string;
  quizTitle?: string;
}

interface Quiz {
  id: string;
  title: Record<string, string>;
  slug: string;
  updated_at: string;
  primary_language: string;
}

const SUPPORTED_LANGUAGES = [
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "en", name: "English" },
  { code: "et", name: "Estonian" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "no", name: "Norwegian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "es", name: "Spanish" },
  { code: "sv", name: "Swedish" },
  { code: "uk", name: "Ukrainian" },
];

// Email translations for preview - includes sample result data
const emailTranslations: Record<string, {
  yourResults: string;
  outOf: string;
  points: string;
  keyInsights: string;
  wantToImprove: string;
  visitSparkly: string;
  leadershipOpenMindedness: string;
  openMindednessOutOf: string;
  // Sample data translations
  sampleResultTitle: string;
  sampleResultDescription: string;
  sampleInsight1: string;
  sampleInsight2: string;
  sampleInsight3: string;
}> = {
  en: {
    yourResults: "Your Team Performance Results",
    outOf: "out of",
    points: "points",
    keyInsights: "Key Insights",
    wantToImprove: "Want to improve your team's performance?",
    visitSparkly: "Visit Sparkly.hr",
    leadershipOpenMindedness: "Leadership Open-Mindedness",
    openMindednessOutOf: "out of 4",
    sampleResultTitle: "Room for Improvement",
    sampleResultDescription: "Your team has solid potential, but friction points are costing you valuable time and slowing growth. Research shows addressing these gaps now can improve productivity by 20-35% within 90 days.",
    sampleInsight1: "Hidden Time Drain: Tasks that should take 2 hours often stretch to 4-6 hours. This \"work expansion\" typically stems from unclear success criteria or skill gaps. Investing in role clarity could recover 8-12 hours of productive time weekly across your team.",
    sampleInsight2: "Communication Debt: Delays and rework often trace back to assumptions rather than confirmed understanding. Implementing brief \"confirm and clarify\" checkpoints could eliminate 40% of revision cycles and reduce frustration for everyone.",
    sampleInsight3: "Untapped Potential: Your team likely has capabilities you're not fully leveraging. When expectations are vague, employees default to playing it safe. Clear, measurable goals paired with autonomy to achieve them could unlock significant hidden performance.",
  },
  et: {
    yourResults: "Sinu meeskonna tulemuslikkuse tulemused",
    outOf: "punkti",
    points: "punktist",
    keyInsights: "Peamised tähelepanekud",
    wantToImprove: "Soovid parandada oma meeskonna tulemuslikkust?",
    visitSparkly: "Külasta Sparkly.hr",
    leadershipOpenMindedness: "Avatud mõtlemisega juhtimine",
    openMindednessOutOf: "4-st",
    sampleResultTitle: "Arenguruumi on",
    sampleResultDescription: "Sinu meeskonnal on tugev potentsiaal, kuid hõõrdumiskohad kulutavad sinu väärtuslikku aega ja aeglustavad kasvu. Uuringud näitavad, et nende lünkade kõrvaldamine võib parandada tootlikkust 20-35% 90 päeva jooksul.",
    sampleInsight1: "Peidetud ajakadu: Ülesanded, mis peaksid võtma 2 tundi, venivad sageli 4-6 tunnini. See \"töö laienemine\" tuleneb tavaliselt ebaselgetest edukriteeriumidest või oskuste lünkadest. Rolliselgusesse investeerimine võiks taastada 8-12 tundi produktiivset aega nädalas kogu meeskonna ulatuses.",
    sampleInsight2: "Kommunikatsioonivõlg: Viivitused ja ümbertöötlemine tulenevad sageli oletustest, mitte kinnitatud arusaamisest. Lühikeste \"kinnita ja selgita\" kontrollpunktide rakendamine võiks elimineerida 40% parandusringidest ja vähendada kõigi frustratsiooni.",
    sampleInsight3: "Kasutamata potentsiaal: Sinu meeskonnal on tõenäoliselt võimeid, mida sa täielikult ei kasuta. Kui ootused on ebamäärased, mängivad töötajad pigem kindla peale. Selged, mõõdetavad eesmärgid koos autonoomsusega nende saavutamiseks võiksid avada märkimisväärse peidetud jõudluse.",
  },
  de: {
    yourResults: "Ihre Team-Leistungsergebnisse",
    outOf: "von",
    points: "Punkten",
    keyInsights: "Wichtige Erkenntnisse",
    wantToImprove: "Möchten Sie die Leistung Ihres Teams verbessern?",
    visitSparkly: "Besuchen Sie Sparkly.hr",
    leadershipOpenMindedness: "Aufgeschlossene Führung",
    openMindednessOutOf: "von 4",
    sampleResultTitle: "Raum für Verbesserung",
    sampleResultDescription: "Ihr Team hat solides Potenzial, aber Reibungspunkte kosten Sie wertvolle Zeit und verlangsamen das Wachstum. Forschungen zeigen, dass die Behebung dieser Lücken die Produktivität um 20-35% innerhalb von 90 Tagen steigern kann.",
    sampleInsight1: "Versteckter Zeitverlust: Aufgaben, die 2 Stunden dauern sollten, dehnen sich oft auf 4-6 Stunden aus. Diese \"Arbeitserweiterung\" resultiert typischerweise aus unklaren Erfolgskriterien oder Kompetenzlücken. Investitionen in Rollenklarheit könnten 8-12 Stunden produktive Zeit wöchentlich in Ihrem Team zurückgewinnen.",
    sampleInsight2: "Kommunikationsschulden: Verzögerungen und Nacharbeit lassen sich oft auf Annahmen statt bestätigtem Verständnis zurückführen. Die Implementierung kurzer \"Bestätigen und Klären\"-Kontrollpunkte könnte 40% der Revisionszyklen eliminieren und Frustration für alle reduzieren.",
    sampleInsight3: "Ungenutztes Potenzial: Ihr Team hat wahrscheinlich Fähigkeiten, die Sie nicht voll nutzen. Bei vagen Erwartungen spielen Mitarbeiter auf Nummer sicher. Klare, messbare Ziele gepaart mit Autonomie könnten erhebliche versteckte Leistung freisetzen.",
  },
  fr: {
    yourResults: "Vos résultats de performance d'équipe",
    outOf: "sur",
    points: "points",
    keyInsights: "Points clés",
    wantToImprove: "Voulez-vous améliorer la performance de votre équipe?",
    visitSparkly: "Visitez Sparkly.hr",
    leadershipOpenMindedness: "Leadership ouvert d'esprit",
    openMindednessOutOf: "sur 4",
    sampleResultTitle: "Marge d'amélioration",
    sampleResultDescription: "Votre équipe a un solide potentiel, mais des points de friction vous coûtent du temps précieux et ralentissent la croissance. La recherche montre que combler ces lacunes peut améliorer la productivité de 20-35% en 90 jours.",
    sampleInsight1: "Perte de temps cachée: Les tâches qui devraient prendre 2 heures s'étendent souvent à 4-6 heures. Cette \"expansion du travail\" provient généralement de critères de succès flous ou de lacunes de compétences. Investir dans la clarté des rôles pourrait récupérer 8-12 heures de temps productif par semaine dans votre équipe.",
    sampleInsight2: "Dette de communication: Les retards et reprises sont souvent dus à des suppositions plutôt qu'à une compréhension confirmée. La mise en place de brefs points de contrôle \"confirmer et clarifier\" pourrait éliminer 40% des cycles de révision et réduire la frustration pour tous.",
    sampleInsight3: "Potentiel inexploité: Votre équipe a probablement des capacités que vous n'exploitez pas pleinement. Quand les attentes sont vagues, les employés jouent la sécurité. Des objectifs clairs et mesurables associés à l'autonomie pourraient libérer une performance cachée significative.",
  },
  es: {
    yourResults: "Tus resultados de rendimiento del equipo",
    outOf: "de",
    points: "puntos",
    keyInsights: "Puntos clave",
    wantToImprove: "¿Quieres mejorar el rendimiento de tu equipo?",
    visitSparkly: "Visita Sparkly.hr",
    leadershipOpenMindedness: "Liderazgo de mente abierta",
    openMindednessOutOf: "de 4",
    sampleResultTitle: "Espacio para mejorar",
    sampleResultDescription: "Tu equipo tiene un sólido potencial, pero los puntos de fricción te están costando tiempo valioso y ralentizando el crecimiento. Las investigaciones muestran que abordar estas brechas ahora puede mejorar la productividad en un 20-35% en 90 días.",
    sampleInsight1: "Pérdida de tiempo oculta: Las tareas que deberían tomar 2 horas a menudo se extienden a 4-6 horas. Esta \"expansión del trabajo\" típicamente proviene de criterios de éxito poco claros o brechas de habilidades. Invertir en claridad de roles podría recuperar 8-12 horas de tiempo productivo semanalmente en tu equipo.",
    sampleInsight2: "Deuda de comunicación: Los retrasos y retrabajos a menudo se deben a suposiciones en lugar de comprensión confirmada. Implementar breves puntos de verificación \"confirmar y aclarar\" podría eliminar el 40% de los ciclos de revisión y reducir la frustración para todos.",
    sampleInsight3: "Potencial sin explotar: Tu equipo probablemente tiene capacidades que no estás aprovechando completamente. Cuando las expectativas son vagas, los empleados juegan a lo seguro. Objetivos claros y medibles combinados con autonomía podrían desbloquear un rendimiento oculto significativo.",
  },
  it: {
    yourResults: "I tuoi risultati di performance del team",
    outOf: "su",
    points: "punti",
    keyInsights: "Punti chiave",
    wantToImprove: "Vuoi migliorare le prestazioni del tuo team?",
    visitSparkly: "Visita Sparkly.hr",
    leadershipOpenMindedness: "Leadership di mentalità aperta",
    openMindednessOutOf: "su 4",
    sampleResultTitle: "Margine di miglioramento",
    sampleResultDescription: "Il tuo team ha un solido potenziale, ma i punti di attrito ti stanno costando tempo prezioso e rallentando la crescita. Le ricerche mostrano che affrontare queste lacune ora può migliorare la produttività del 20-35% entro 90 giorni.",
    sampleInsight1: "Perdita di tempo nascosta: Le attività che dovrebbero richiedere 2 ore spesso si estendono a 4-6 ore. Questa \"espansione del lavoro\" deriva tipicamente da criteri di successo poco chiari o lacune di competenze. Investire nella chiarezza dei ruoli potrebbe recuperare 8-12 ore di tempo produttivo settimanali nel tuo team.",
    sampleInsight2: "Debito di comunicazione: Ritardi e rilavorazioni spesso derivano da supposizioni piuttosto che da comprensione confermata. Implementare brevi checkpoint \"conferma e chiarisci\" potrebbe eliminare il 40% dei cicli di revisione e ridurre la frustrazione per tutti.",
    sampleInsight3: "Potenziale inutilizzato: Il tuo team probabilmente ha capacità che non stai sfruttando appieno. Quando le aspettative sono vaghe, i dipendenti giocano sul sicuro. Obiettivi chiari e misurabili abbinati all'autonomia potrebbero sbloccare prestazioni nascoste significative.",
  },
  pt: {
    yourResults: "Os seus resultados de desempenho da equipa",
    outOf: "de",
    points: "pontos",
    keyInsights: "Pontos-chave",
    wantToImprove: "Quer melhorar o desempenho da sua equipa?",
    visitSparkly: "Visite Sparkly.hr",
    leadershipOpenMindedness: "Liderança de mente aberta",
    openMindednessOutOf: "de 4",
    sampleResultTitle: "Espaço para melhorar",
    sampleResultDescription: "A sua equipa tem potencial sólido, mas pontos de fricção estão a custar-lhe tempo valioso e a abrandar o crescimento. A pesquisa mostra que abordar estas lacunas agora pode melhorar a produtividade em 20-35% em 90 dias.",
    sampleInsight1: "Perda de tempo oculta: Tarefas que deveriam levar 2 horas muitas vezes estendem-se para 4-6 horas. Esta \"expansão do trabalho\" normalmente resulta de critérios de sucesso pouco claros ou lacunas de competências. Investir na clareza de funções poderia recuperar 8-12 horas de tempo produtivo semanalmente na sua equipa.",
    sampleInsight2: "Dívida de comunicação: Atrasos e retrabalho frequentemente resultam de suposições em vez de compreensão confirmada. Implementar breves pontos de verificação \"confirmar e esclarecer\" poderia eliminar 40% dos ciclos de revisão e reduzir a frustração para todos.",
    sampleInsight3: "Potencial inexplorado: A sua equipa provavelmente tem capacidades que não está a aproveitar totalmente. Quando as expectativas são vagas, os funcionários jogam pelo seguro. Objetivos claros e mensuráveis combinados com autonomia poderiam desbloquear um desempenho oculto significativo.",
  },
  nl: {
    yourResults: "Uw teamprestatie resultaten",
    outOf: "van",
    points: "punten",
    keyInsights: "Belangrijke inzichten",
    wantToImprove: "Wilt u de prestaties van uw team verbeteren?",
    visitSparkly: "Bezoek Sparkly.hr",
    leadershipOpenMindedness: "Open-minded leiderschap",
    openMindednessOutOf: "van 4",
    sampleResultTitle: "Ruimte voor verbetering",
    sampleResultDescription: "Uw team heeft solide potentieel, maar wrijvingspunten kosten u waardevolle tijd en vertragen de groei. Onderzoek toont aan dat het nu aanpakken van deze hiaten de productiviteit met 20-35% kan verbeteren binnen 90 dagen.",
    sampleInsight1: "Verborgen tijdverlies: Taken die 2 uur zouden moeten duren, strekken zich vaak uit tot 4-6 uur. Deze \"werkexpansie\" komt meestal voort uit onduidelijke succescriteria of vaardigheidstekorten. Investeren in rolhelderheid zou 8-12 uur productieve tijd per week kunnen terugwinnen in uw team.",
    sampleInsight2: "Communicatieschuld: Vertragingen en herwerk zijn vaak te herleiden tot aannames in plaats van bevestigd begrip. Het implementeren van korte \"bevestigen en verduidelijken\" checkpoints zou 40% van de revisiecycli kunnen elimineren en frustratie voor iedereen verminderen.",
    sampleInsight3: "Onbenut potentieel: Uw team heeft waarschijnlijk capaciteiten die u niet volledig benut. Bij vage verwachtingen spelen medewerkers op safe. Duidelijke, meetbare doelen gecombineerd met autonomie zouden aanzienlijke verborgen prestaties kunnen ontsluiten.",
  },
  pl: {
    yourResults: "Twoje wyniki wydajności zespołu",
    outOf: "z",
    points: "punktów",
    keyInsights: "Kluczowe spostrzeżenia",
    wantToImprove: "Chcesz poprawić wydajność swojego zespołu?",
    visitSparkly: "Odwiedź Sparkly.hr",
    leadershipOpenMindedness: "Przywództwo otwarte na innowacje",
    openMindednessOutOf: "z 4",
    sampleResultTitle: "Pole do poprawy",
    sampleResultDescription: "Twój zespół ma solidny potencjał, ale punkty tarcia kosztują cię cenny czas i spowalniają wzrost. Badania pokazują, że zajęcie się tymi lukami teraz może poprawić produktywność o 20-35% w ciągu 90 dni.",
    sampleInsight1: "Ukryta strata czasu: Zadania, które powinny zająć 2 godziny, często rozciągają się do 4-6 godzin. Ta \"ekspansja pracy\" zazwyczaj wynika z niejasnych kryteriów sukcesu lub luk w umiejętnościach. Inwestowanie w jasność ról mogłoby odzyskać 8-12 godzin produktywnego czasu tygodniowo w całym zespole.",
    sampleInsight2: "Dług komunikacyjny: Opóźnienia i przeróbki często wynikają z założeń, a nie potwierdzonego zrozumienia. Wdrożenie krótkich punktów kontrolnych \"potwierdź i wyjaśnij\" mogłoby wyeliminować 40% cykli rewizji i zmniejszyć frustrację dla wszystkich.",
    sampleInsight3: "Niewykorzystany potencjał: Twój zespół prawdopodobnie ma możliwości, których w pełni nie wykorzystujesz. Gdy oczekiwania są niejasne, pracownicy grają bezpiecznie. Jasne, mierzalne cele w połączeniu z autonomią mogłyby odblokować znaczną ukrytą wydajność.",
  },
  ru: {
    yourResults: "Результаты производительности вашей команды",
    outOf: "из",
    points: "баллов",
    keyInsights: "Ключевые выводы",
    wantToImprove: "Хотите улучшить производительность вашей команды?",
    visitSparkly: "Посетите Sparkly.hr",
    leadershipOpenMindedness: "Открытое лидерство",
    openMindednessOutOf: "из 4",
    sampleResultTitle: "Есть куда расти",
    sampleResultDescription: "У вашей команды есть хороший потенциал, но точки трения отнимают ваше ценное время и замедляют рост. Исследования показывают, что устранение этих пробелов сейчас может повысить продуктивность на 20-35% в течение 90 дней.",
    sampleInsight1: "Скрытая потеря времени: Задачи, которые должны занимать 2 часа, часто растягиваются до 4-6 часов. Это \"расширение работы\" обычно происходит из-за неясных критериев успеха или пробелов в навыках. Инвестиции в ясность ролей могут вернуть 8-12 часов продуктивного времени еженедельно по всей команде.",
    sampleInsight2: "Коммуникационный долг: Задержки и переделки часто возникают из-за предположений, а не подтвержденного понимания. Внедрение кратких контрольных точек \"подтвердить и уточнить\" может устранить 40% циклов пересмотра и снизить разочарование для всех.",
    sampleInsight3: "Неиспользованный потенциал: У вашей команды, вероятно, есть способности, которые вы не используете полностью. Когда ожидания размыты, сотрудники перестраховываются. Четкие, измеримые цели в сочетании с автономией могут раскрыть значительную скрытую производительность.",
  },
  sv: {
    yourResults: "Dina teamprestationsresultat",
    outOf: "av",
    points: "poäng",
    keyInsights: "Viktiga insikter",
    wantToImprove: "Vill du förbättra ditt teams prestation?",
    visitSparkly: "Besök Sparkly.hr",
    leadershipOpenMindedness: "Öppensinnat ledarskap",
    openMindednessOutOf: "av 4",
    sampleResultTitle: "Utrymme för förbättring",
    sampleResultDescription: "Ditt team har solid potential, men friktionspunkter kostar dig värdefull tid och bromsar tillväxten. Forskning visar att åtgärda dessa luckor nu kan förbättra produktiviteten med 20-35% inom 90 dagar.",
    sampleInsight1: "Dold tidsförlust: Uppgifter som borde ta 2 timmar sträcker sig ofta till 4-6 timmar. Denna \"arbetsexpansion\" beror vanligtvis på otydliga framgångskriterier eller kompetensluckor. Att investera i rollklarhet kan återvinna 8-12 timmars produktiv tid varje vecka i ditt team.",
    sampleInsight2: "Kommunikationsskuld: Förseningar och omarbete beror ofta på antaganden snarare än bekräftad förståelse. Att implementera korta \"bekräfta och förtydliga\" kontrollpunkter kan eliminera 40% av revisionscyklerna och minska frustration för alla.",
    sampleInsight3: "Outnyttjad potential: Ditt team har troligen förmågor som du inte utnyttjar fullt ut. När förväntningarna är vaga spelar anställda säkert. Tydliga, mätbara mål i kombination med autonomi kan låsa upp betydande dold prestation.",
  },
  no: {
    yourResults: "Dine teamytelsesresultater",
    outOf: "av",
    points: "poeng",
    keyInsights: "Viktige innsikter",
    wantToImprove: "Vil du forbedre teamets ytelse?",
    visitSparkly: "Besøk Sparkly.hr",
    leadershipOpenMindedness: "Åpent lederskap",
    openMindednessOutOf: "av 4",
    sampleResultTitle: "Rom for forbedring",
    sampleResultDescription: "Teamet ditt har solid potensial, men friksjonspunkter koster deg verdifull tid og bremser veksten. Forskning viser at å ta tak i disse hullene nå kan forbedre produktiviteten med 20-35% innen 90 dager.",
    sampleInsight1: "Skjult tidstap: Oppgaver som burde ta 2 timer strekker seg ofte til 4-6 timer. Denne \"arbeidsekspansjonen\" stammer vanligvis fra uklare suksesskriterier eller kompetansehull. Å investere i rolleklarhet kunne gjenvinne 8-12 timer produktiv tid ukentlig i teamet ditt.",
    sampleInsight2: "Kommunikasjonsgjeld: Forsinkelser og omarbeiding skyldes ofte antakelser i stedet for bekreftet forståelse. Å implementere korte \"bekreft og avklar\" sjekkpunkter kunne eliminere 40% av revisjonssyklusene og redusere frustrasjon for alle.",
    sampleInsight3: "Uutnyttet potensial: Teamet ditt har sannsynligvis evner du ikke utnytter fullt ut. Når forventningene er vage, spiller ansatte det trygt. Klare, målbare mål kombinert med autonomi kunne låse opp betydelig skjult ytelse.",
  },
  da: {
    yourResults: "Dine teampræstationsresultater",
    outOf: "af",
    points: "point",
    keyInsights: "Vigtige indsigter",
    wantToImprove: "Vil du forbedre dit teams præstation?",
    visitSparkly: "Besøg Sparkly.hr",
    leadershipOpenMindedness: "Åbensindet lederskab",
    openMindednessOutOf: "af 4",
    sampleResultTitle: "Plads til forbedring",
    sampleResultDescription: "Dit team har solidt potentiale, men friktionspunkter koster dig værdifuld tid og bremser væksten. Forskning viser, at at tage fat på disse huller nu kan forbedre produktiviteten med 20-35% inden for 90 dage.",
    sampleInsight1: "Skjult tidstab: Opgaver, der burde tage 2 timer, strækker sig ofte til 4-6 timer. Denne \"arbejdsudvidelse\" stammer typisk fra uklare succeskriterier eller kompetencehuller. Investering i rolleklarhed kunne genvinde 8-12 timers produktiv tid ugentligt i dit team.",
    sampleInsight2: "Kommunikationsgæld: Forsinkelser og omarbejde skyldes ofte antagelser frem for bekræftet forståelse. Implementering af korte \"bekræft og afklar\" checkpoints kunne eliminere 40% af revisionscyklusser og reducere frustration for alle.",
    sampleInsight3: "Uudnyttet potentiale: Dit team har sandsynligvis evner, du ikke udnytter fuldt ud. Når forventningerne er vage, spiller medarbejdere det sikkert. Klare, målbare mål parret med autonomi kunne frigøre betydelig skjult præstation.",
  },
  fi: {
    yourResults: "Tiimisuorituksesi tulokset",
    outOf: "/",
    points: "pistettä",
    keyInsights: "Keskeiset oivallukset",
    wantToImprove: "Haluatko parantaa tiimisi suorituskykyä?",
    visitSparkly: "Vieraile Sparkly.hr",
    leadershipOpenMindedness: "Avoimen mielen johtajuus",
    openMindednessOutOf: "/ 4",
    sampleResultTitle: "Parannettavaa on",
    sampleResultDescription: "Tiimilläsi on vahva potentiaali, mutta kitkakohdat kuluttavat arvokasta aikaasi ja hidastavat kasvua. Tutkimukset osoittavat, että näiden aukkojen korjaaminen nyt voi parantaa tuottavuutta 20-35% 90 päivän kuluessa.",
    sampleInsight1: "Piilotettu aikahukka: Tehtävät, joiden pitäisi kestää 2 tuntia, venyvät usein 4-6 tuntiin. Tämä \"työn laajeneminen\" johtuu tyypillisesti epäselvistä menestyksen kriteereistä tai osaamisaukoista. Roolien selkeyttämiseen investoiminen voisi palauttaa 8-12 tuntia tuottavaa aikaa viikoittain tiimissäsi.",
    sampleInsight2: "Viestintävelka: Viivästykset ja uudelleentyöt johtuvat usein olettamuksista vahvistetun ymmärryksen sijaan. Lyhyiden \"vahvista ja selventä\" tarkistuspisteiden käyttöönotto voisi eliminoida 40% tarkistuskierroksista ja vähentää kaikkien turhautumista.",
    sampleInsight3: "Hyödyntämätön potentiaali: Tiimilläsi on todennäköisesti kykyjä, joita et täysin hyödynnä. Kun odotukset ovat epämääräisiä, työntekijät pelaavat varman päälle. Selkeät, mitattavat tavoitteet yhdistettynä autonomiaan voisivat vapauttaa merkittävää piilotettua suorituskykyä.",
  },
  uk: {
    yourResults: "Результати продуктивності вашої команди",
    outOf: "з",
    points: "балів",
    keyInsights: "Ключові висновки",
    wantToImprove: "Хочете покращити продуктивність вашої команди?",
    visitSparkly: "Відвідайте Sparkly.hr",
    leadershipOpenMindedness: "Відкрите лідерство",
    openMindednessOutOf: "з 4",
    sampleResultTitle: "Є куди зростати",
    sampleResultDescription: "Ваша команда має міцний потенціал, але точки тертя коштують вам цінного часу та уповільнюють зростання. Дослідження показують, що усунення цих прогалин зараз може підвищити продуктивність на 20-35% протягом 90 днів.",
    sampleInsight1: "Прихована втрата часу: Завдання, які повинні займати 2 години, часто розтягуються до 4-6 годин. Це \"розширення роботи\" зазвичай виникає через нечіткі критерії успіху або прогалини в навичках. Інвестування в ясність ролей може повернути 8-12 годин продуктивного часу щотижня по всій команді.",
    sampleInsight2: "Комунікаційний борг: Затримки та переробки часто виникають через припущення, а не підтверджене розуміння. Впровадження коротких контрольних точок \"підтвердити та уточнити\" може усунути 40% циклів перегляду та зменшити розчарування для всіх.",
    sampleInsight3: "Невикористаний потенціал: Ваша команда, ймовірно, має здібності, які ви не використовуєте повністю. Коли очікування розмиті, працівники перестраховуються. Чіткі, вимірювані цілі в поєднанні з автономією можуть розблокувати значну приховану продуктивність.",
  },
};


export function EmailTemplateManager({ quizId: propQuizId, quizTitle }: EmailTemplateManagerProps = {}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const { toast } = useToast();

  // Quiz selection state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>(propQuizId || "");
  const [quizzesLoading, setQuizzesLoading] = useState(false);

  // Form state for new version
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [subjects, setSubjects] = useState<Record<string, string>>({});

  // Preview dialog state
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);


  // Fetch quizzes and set default based on most recent activity
  useEffect(() => {
    if (!propQuizId) {
      fetchQuizzes();
    }
  }, [propQuizId]);

  // Fetch templates when quiz selection changes
  useEffect(() => {
    const quizIdToUse = propQuizId || selectedQuizId;
    if (quizIdToUse) {
      fetchTemplates(quizIdToUse);
    }
  }, [propQuizId, selectedQuizId]);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchQuizzes = async () => {
    setQuizzesLoading(true);
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, slug, updated_at, primary_language")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const typedQuizzes = (data || []).map(q => ({
        ...q,
        title: q.title as Record<string, string>,
      }));

      setQuizzes(typedQuizzes);

      // Prefill with most recently updated quiz if no quiz is selected
      if (!selectedQuizId && typedQuizzes.length > 0) {
        setSelectedQuizId(typedQuizzes[0].id);
      }
    } catch (error: any) {
      console.error("Error fetching quizzes:", error);
      toast({
        title: "Error",
        description: "Failed to fetch quizzes",
        variant: "destructive",
      });
    } finally {
      setQuizzesLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setCurrentUserEmail(user.email);
    }
  };

  // Computed quiz ID - use prop if provided, otherwise use selected
  const currentQuizId = propQuizId || selectedQuizId;

  const fetchTemplates = async (quizIdToFetch?: string) => {
    const quizIdToUse = quizIdToFetch || currentQuizId;
    if (!quizIdToUse) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const query = supabase
        .from("email_templates")
        .select("*")
        .eq("template_type", "quiz_results")
        .eq("quiz_id", quizIdToUse);
      
      const { data, error } = await query.order("version_number", { ascending: false });

      if (error) throw error;

      const typedData = (data || []).map(item => ({
        ...item,
        subjects: item.subjects as Record<string, string>,
        quiz_id: item.quiz_id as string | null
      }));

      setTemplates(typedData);

      // Load live template into form
      const liveTemplate = typedData.find(t => t.is_live);
      if (liveTemplate) {
        setSenderName(liveTemplate.sender_name);
        setSenderEmail(liveTemplate.sender_email);
        setSubjects(liveTemplate.subjects);
      } else if (typedData.length === 0) {
        // Reset form if no templates exist for this quiz
        setSenderName("");
        setSenderEmail("");
        setSubjects({});
      }
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      toast({
        title: "Error",
        description: "Failed to fetch email templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  const saveNewVersion = async () => {
    if (!currentQuizId) {
      toast({
        title: "Validation Error",
        description: "Please select a quiz first",
        variant: "destructive",
      });
      return;
    }

    if (!senderName.trim() || !senderEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Sender name and email are required",
        variant: "destructive",
      });
      return;
    }

    // Get the primary language subject
    const selectedQuiz = quizzes.find(q => q.id === currentQuizId);
    const primaryLanguage = selectedQuiz?.primary_language || "en";
    const primarySubject = subjects[primaryLanguage];

    if (!primarySubject?.trim()) {
      toast({
        title: "Validation Error",
        description: "Subject line is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Get next version number for this specific quiz
      const maxVersion = templates.length > 0 
        ? Math.max(...templates.map(t => t.version_number)) 
        : 0;

      // First, set all existing templates for this quiz to not live
      await supabase
        .from("email_templates")
        .update({ is_live: false })
        .eq("template_type", "quiz_results")
        .eq("quiz_id", currentQuizId);

      // Insert new version as live (with just the primary language subject initially)
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: insertedTemplate, error } = await supabase
        .from("email_templates")
        .insert({
          version_number: maxVersion + 1,
          template_type: "quiz_results",
          sender_name: senderName.trim(),
          sender_email: senderEmail.trim(),
          subjects: { [primaryLanguage]: primarySubject },
          is_live: true,
          created_by: user?.id,
          created_by_email: user?.email || currentUserEmail,
          quiz_id: currentQuizId,
        })
        .select()
        .single();

      if (error) throw error;

      // Now trigger AI translation for the subject line
      toast({
        title: "Template saved",
        description: "Translating subject line to other languages...",
      });

      try {
        const { data: translateData, error: translateError } = await supabase.functions.invoke(
          "translate-email-template",
          {
            body: {
              templateId: insertedTemplate.id,
              sourceLanguage: primaryLanguage,
              sourceSubject: primarySubject,
            },
          }
        );

        if (translateError) {
          console.error("Translation error:", translateError);
          toast({
            title: "Translation warning",
            description: "Template saved but translation failed. You can manually add translations later.",
            variant: "destructive",
          });
        } else {
          const cost = translateData?.cost || 0;
          toast({
            title: "Template saved & translated",
            description: `Version ${maxVersion + 1} is now live. Translation cost: €${cost.toFixed(4)}`,
          });
        }
      } catch (translateErr) {
        console.error("Translation error:", translateErr);
        toast({
          title: "Translation warning", 
          description: "Template saved but translation failed.",
          variant: "destructive",
        });
      }

      fetchTemplates();
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const setLiveVersion = async (templateId: string, versionNumber: number) => {
    if (!currentQuizId) return;
    
    try {
      // Set all templates for this quiz to not live
      await supabase
        .from("email_templates")
        .update({ is_live: false })
        .eq("template_type", "quiz_results")
        .eq("quiz_id", currentQuizId);

      // Set selected as live
      const { error } = await supabase
        .from("email_templates")
        .update({ is_live: true })
        .eq("id", templateId);

      if (error) throw error;

      toast({
        title: "Live version updated",
        description: `Version ${versionNumber} is now live`,
      });

      fetchTemplates();
    } catch (error: any) {
      console.error("Error setting live version:", error);
      toast({
        title: "Error",
        description: "Failed to update live version",
        variant: "destructive",
      });
    }
  };

  const loadVersionToEdit = (template: EmailTemplate) => {
    setSenderName(template.sender_name);
    setSenderEmail(template.sender_email);
    setSubjects(template.subjects);
    toast({
      title: "Version loaded",
      description: `Version ${template.version_number} loaded into editor`,
    });
  };

  const updateSubject = (langCode: string, value: string) => {
    setSubjects(prev => ({
      ...prev,
      [langCode]: value,
    }));
  };

  const openPreviewDialog = (template: EmailTemplate) => {
    setPreviewTemplate(template);
    setPreviewDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const liveTemplate = templates.find(t => t.is_live);

  // Get the selected quiz for display
  const selectedQuiz = quizzes.find((q) => q.id === currentQuizId);

  if (loading && !quizzesLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading email templates...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {currentQuizId && (
        <Tabs defaultValue="web" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="web" className="gap-2">
              <Globe className="w-4 h-4" />
              Web Templates
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="w-4 h-4" />
              Email Templates
            </TabsTrigger>
            <TabsTrigger value="server" className="gap-2">
              <Server className="w-4 h-4" />
              Email Server
            </TabsTrigger>
          </TabsList>

          {/* Web Templates Tab */}
          <TabsContent value="web" className="space-y-6">
            <WebVersionHistory quizId={currentQuizId} />
          </TabsContent>

          {/* Email Templates Tab */}
          <TabsContent value="email" className="space-y-6">
            {/* Current Live Status */}
            {liveTemplate && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Check className="w-5 h-5 text-primary" />
                      Currently Live: Version {liveTemplate.version_number}
                    </CardTitle>
                    <Badge variant="default" className="bg-primary">LIVE</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>Sender: <span className="text-foreground font-medium">{liveTemplate.sender_name} &lt;{liveTemplate.sender_email}&gt;</span></p>
                  <p className="mt-1">Updated: {formatDate(liveTemplate.created_at)} by {liveTemplate.created_by_email || "Unknown"}</p>
                </CardContent>
              </Card>
            )}

            {/* Editor Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Email Template Editor</CardTitle>
                  <Button onClick={() => fetchTemplates()} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Sender Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="senderName">Sender Name</Label>
                    <Input
                      id="senderName"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Sparkly.hr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senderEmail">Sender Email</Label>
                    <Input
                      id="senderEmail"
                      type="email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="support@sparkly.hr"
                    />
                  </div>
                </div>

                {/* Subject Line - Primary Language Only */}
                <div className="space-y-2">
                  <Label htmlFor="subjectLine" className="text-base font-semibold">
                    Email Subject 
                    <span className="text-muted-foreground font-normal ml-2">
                      ({selectedQuiz?.primary_language === 'et' ? 'Estonian' : 'English'} - will be auto-translated)
                    </span>
                  </Label>
                  <Input
                    id="subjectLine"
                    value={subjects[selectedQuiz?.primary_language || 'en'] || ''}
                    onChange={(e) => updateSubject(selectedQuiz?.primary_language || 'en', e.target.value)}
                    placeholder={`Enter subject in ${selectedQuiz?.primary_language === 'et' ? 'Estonian' : 'English'}...`}
                    className="text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    Other language subjects will be automatically translated from this primary language subject when sending emails.
                  </p>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={saveNewVersion} disabled={saving} className="gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : "Save as New Version & Set Live"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview Live Template */}
            {liveTemplate && (
              <div className="flex justify-center">
                <Button 
                  variant="outline"
                  onClick={() => openPreviewDialog(liveTemplate)}
                  className="gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Preview & Send Test Email
                </Button>
              </div>
            )}

            {/* Email Version History */}
            <EmailVersionHistory 
              quizId={currentQuizId} 
              onLoadTemplate={(template) => {
                setSenderName(template.sender_name);
                setSenderEmail(template.sender_email);
                setSubjects(template.subjects);
                toast({
                  title: "Version loaded",
                  description: `Version ${template.version_number} loaded into editor`,
                });
              }}
              onSetLive={() => fetchTemplates()}
              onPreview={(template) => openPreviewDialog(template)}
            />
          </TabsContent>

          {/* Email Server Tab */}
          <TabsContent value="server" className="space-y-6">
            <EmailSettings />
          </TabsContent>
        </Tabs>
      )}

      {/* Email Preview Dialog */}
      <EmailPreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        template={previewTemplate}
        quiz={selectedQuiz || null}
        defaultEmail={currentUserEmail}
        emailTranslations={emailTranslations}
      />
    </div>
  );
}
