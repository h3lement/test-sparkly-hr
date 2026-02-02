# Emotional Quiz Blueprint (Sedona Method Emotional Scale)

## Overview
This quiz measures emotional states using the Sedona Method Emotional Scale (1-9 scale).
- **Quiz Type**: `emotional`
- **Questions**: 12 questions
- **Answers per question**: 5 options (scored 1, 3, 5, 7, 9)
- **Scoring**: Average-based (sum / 12, displayed on 1-9 scale)
- **Result Levels**: 9 levels corresponding to emotional states

---

## Scoring Logic

```typescript
// Calculate average score (1-9 scale)
const questionCount = answers.length || 12;
const averageScore = totalScore / questionCount;
const emotionalLevel = Math.round(averageScore);

// For database storage: totalScore = sum of all answer values (range: 12-108)
// For display: averageScore = totalScore / 12 (range: 1-9)

// Find matching result level (stored as integers 10-90 in DB, representing 1.0-9.0)
const result = resultLevels.find(
  (level) => totalScore >= level.min_score && totalScore <= level.max_score
);

// Calculate percentage for visual display
const percentage = Math.round((averageScore / 9) * 100);
```

### Answer Score Values
Each answer is scored: **1, 3, 5, 7, or 9** (representing the 9-level Sedona scale)

---

## Sedona Emotional Levels (1-9)

| Level | Name (EN) | Name (ET) | Description (EN) | Description (ET) |
|-------|-----------|-----------|------------------|------------------|
| 1 | Apathy | Apaatia | Feeling disconnected from life, lack of motivation | Tundub elust eraldatud, motivatsiooni puudumine |
| 2 | Grief | Lein | Processing loss, deep sadness | Kaotuse töötlemine, sügav kurbus |
| 3 | Fear | Hirm | Anxiety, worry about the future | Ärevus, mure tuleviku pärast |
| 4 | Lust | Iha | Craving, wanting, desire-driven | Ihalus, soovipõhine |
| 5 | Anger | Viha | Frustration, resistance, blame | Frustratsioon, vastupanu, süüdistamine |
| 6 | Pride | Uhkus | Need for recognition, comparing | Tunnustuse vajadus, võrdlemine |
| 7 | Courage | Julgus | Willingness to try, openness | Valmisolek proovida, avatus |
| 8 | Acceptance | Aktsepteerimine | Peace with what is, allowing | Rahu sellega, mis on, lubamine |
| 9 | Peace | Rahu | Inner stillness, deep contentment | Sisemine vaikus, sügav rahulolu |

---

## Questions (Estonian & English)

### Question 1
**EN**: When you think about your current life situation, which of these best describes your inner experience?
**ET**: Kui mõtled oma praegusele eluolukorrale, siis milline neist kirjeldab kõige paremini Sinu sisemist kogemust?

#### Answers:
| Order | Score | English | Estonian |
|-------|-------|---------|----------|
| 1 | 9 | I feel a sense of inner stillness and deep contentment with how things are | Tunnen sisemist vaikust ja sügavat rahulolu sellega, kuidas asjad on |
| 2 | 7 | I'm accepting and at peace with challenges, seeing them as growth opportunities | Aktsepteerin ja olen rahul väljakutsetega, nähes neid kasvuvõimalustena |
| 3 | 5 | I'm frustrated with how things are and feel driven to change them forcefully | Olen pettunud, kuidas asjad on, ja tunnen vajadust neid jõuliselt muuta |
| 4 | 3 | I often worry about what might go wrong and feel anxious about the future | Muretsem sageli, mis võib valesti minna, ja tunnen ärevust tuleviku pärast |
| 5 | 1 | I feel disconnected and unable to see the point in making changes | Tunnen end eraldatuna ja ei näe mõtet muudatuste tegemises |

### Question 2
**EN**: How do you typically respond to unexpected changes or setbacks?
**ET**: Kuidas tavaliselt reageerid ootamatutele muutustele või tagasilöökidele?

#### Answers:
| Order | Score | English | Estonian |
|-------|-------|---------|----------|
| 1 | 9 | I remain calm and centered, trusting that everything will work out | Jään rahulikuks ja tasakaalukakas, usaldades, et kõik laheneb |
| 2 | 7 | I adapt willingly and look for the lessons in the situation | Kohanen vabatahtlikult ja otsin olukorrast õppetunde |
| 3 | 5 | I feel angry or resistant, wanting to push back against what happened | Tunnen viha või vastupanu, tahtes vastu seista sellele, mis juhtus |
| 4 | 3 | I become fearful and worried about the consequences | Muutun hirmutatuks ja muretsen tagajärgede pärast |
| 5 | 1 | I feel overwhelmed and tend to shut down or give up | Tunnen end ülekoormatuna ja kipun sulguma või loobuma |

### Question 3
**EN**: When thinking about your goals and ambitions, what best describes your motivation?
**ET**: Kui mõtled oma eesmärkidele ja ambitsioonidele, mis kirjeldab kõige paremini Sinu motivatsiooni?

#### Answers:
| Order | Score | English | Estonian |
|-------|-------|---------|----------|
| 1 | 9 | I feel fulfilled already; goals arise naturally from a place of peace | Tunnen end juba täidetuna; eesmärgid tõusevad loomulikult rahu kohast |
| 2 | 7 | I pursue goals with enthusiasm while being okay if things don't work out | Jälitan eesmärke entusiasmiga, olles okei, kui asjad ei õnnestu |
| 3 | 5 | I need to prove myself or show others I'm successful | Pean tõestama ennast või näitama teistele, et olen edukas |
| 4 | 3 | I want things intensely but often feel I can't have what I truly desire | Tahan asju intensiivselt, aga tunnen sageli, et ei saa seda, mida tõeliselt soovin |
| 5 | 1 | I've lost interest in goals; nothing seems worth pursuing | Olen kaotanud huvi eesmärkide vastu; miski ei tundu jälitamist väärt |

### Question 4
**EN**: How do you relate to difficult emotions when they arise?
**ET**: Kuidas suhtud rasketesse emotsioonidesse, kui need tõusevad?

#### Answers:
| Order | Score | English | Estonian |
|-------|-------|---------|----------|
| 1 | 9 | I observe them with compassion and let them pass naturally | Vaatlen neid kaastundega ja lasen neil loomulikult mööduda |
| 2 | 7 | I acknowledge them and work through them constructively | Tunnistan neid ja töötan nendega konstruktiivselt |
| 3 | 5 | I often react strongly and express my emotions outwardly | Reageerin sageli tugevalt ja väljendan oma emotsioone väliselt |
| 4 | 3 | I try to suppress or avoid them because they feel too overwhelming | Püüan neid maha suruda või vältida, sest need tunduvad liiga ülekaalukad |
| 5 | 1 | I feel numb or disconnected from my emotions most of the time | Tunnen end tuimana või emotsioonidest eraldatuna enamuse ajast |

### Question 5
**EN**: How would you describe your general energy levels throughout the day?
**ET**: Kuidas kirjeldaksid oma üldist energiataset päeva jooksul?

#### Answers:
| Order | Score | English | Estonian |
|-------|-------|---------|----------|
| 1 | 9 | I feel naturally energized and peaceful, without needing external stimulation | Tunnen end loomulikult energilise ja rahulikuna, ilma välise stimulatsioonita |
| 2 | 7 | I have good energy and actively engage with life's activities | Mul on hea energia ja tegelen aktiivselt elu tegevustega |
| 3 | 5 | My energy fluctuates based on whether things are going my way | Mu energia kõigub sõltuvalt sellest, kas asjad lähevad minu tahtmist mööda |
| 4 | 3 | I often feel drained by worry or anxious thoughts | Tunnen end sageli kurnatuna murest või ärevatest mõtetest |
| 5 | 1 | I struggle to find energy for even basic daily activities | Mul on raske leida energiat isegi põhilisteks igapäevategevusteks |

### Question 6
**EN**: How do you typically view other people?
**ET**: Kuidas tavaliselt vaatad teisi inimesi?

#### Answers:
| Order | Score | English | Estonian |
|-------|-------|---------|----------|
| 1 | 9 | I see everyone as inherently valuable and feel connected to others | Näen kõiki kui olemuslikult väärtuslikke ja tunnen ühendust teistega |
| 2 | 7 | I appreciate people for who they are, including their flaws | Hindan inimesi selle eest, kes nad on, kaasa arvatud nende vead |
| 3 | 5 | I sometimes compare myself to others or feel competitive | Võrdlen end mõnikord teistega või tunnen konkurentsi |
| 4 | 3 | I often feel threatened or intimidated by certain people | Tunnen end sageli ohustatuna või hirmutatud teatud inimeste poolt |
| 5 | 1 | I feel isolated and struggle to connect with anyone | Tunnen end isoleerituna ja mul on raske kellegagi ühendust luua |

### Question 7
**EN**: When you make a mistake or fail at something, how do you typically respond?
**ET**: Kui teed vea või ebaõnnestud milleski, kuidas tavaliselt reageerid?

#### Answers:
| Order | Score | English | Estonian |
|-------|-------|---------|----------|
| 1 | 9 | I accept it with equanimity and move forward without self-judgment | Aktsepteerin seda tasakaalukalt ja liigun edasi ilma enesehinnangu andmiseta |
| 2 | 7 | I learn from it and try again with a positive attitude | Õpin sellest ja proovin uuesti positiivse suhtumisega |
| 3 | 5 | I get frustrated with myself or blame external circumstances | Pettun endas või süüdistan väliseid asjaolusid |
| 4 | 3 | I feel deeply sad or disappointed, sometimes for extended periods | Tunnen end sügavalt kurvana või pettununa, mõnikord pikka aega |
| 5 | 1 | I use it as confirmation that trying is pointless | Kasutan seda kinnitusena, et proovimine on mõttetu |

### Question 8
**EN**: How do you feel about the future?
**ET**: Kuidas suhtud tulevikku?

#### Answers:
| Order | Score | English | Estonian |
|-------|-------|---------|----------|
| 1 | 9 | I trust that life will unfold perfectly, regardless of specifics | Usaldan, et elu areneb ideaalselt, olenemata üksikasjadest |
| 2 | 7 | I feel optimistic and look forward to what's ahead | Tunnen end optimistlikuna ja ootan, mis ees on |
| 3 | 5 | I feel I need to control outcomes to ensure a good future | Tunnen, et pean kontrollima tulemusi, et tagada hea tulevik |
| 4 | 3 | I often worry about what might go wrong | Muretsem sageli, mis võib valesti minna |
| 5 | 1 | The future feels hopeless or meaningless to me | Tulevik tundub mulle lootusetu või mõttetu |

### Question 9
**EN**: How do you experience satisfaction in your daily life?
**ET**: Kuidas koged rahulolu oma igapäevaelus?

#### Answers:
| Order | Score | English | Estonian |
|-------|-------|---------|----------|
| 1 | 9 | I feel deeply content with simple moments and everyday experiences | Tunnen sügavat rahulolu lihtsate hetkedega ja igapäevaste kogemustega |
| 2 | 7 | I find joy in many activities and relationships | Leian rõõmu paljudest tegevustest ja suhetest |
| 3 | 5 | Satisfaction depends on achieving specific goals or outcomes | Rahulolu sõltub konkreetsete eesmärkide või tulemuste saavutamisest |
| 4 | 3 | I often feel something is missing even when things are going well | Tunnen sageli, et midagi on puudu, isegi kui asjad lähevad hästi |
| 5 | 1 | I rarely experience satisfaction or pleasure in anything | Kogen harva rahulolu või naudingut milleski |

### Question 10
**EN**: How do you typically handle conflict in relationships?
**ET**: Kuidas tavaliselt käitled konflikte suhetes?

#### Answers:
| Order | Score | English | Estonian |
|-------|-------|---------|----------|
| 1 | 9 | I remain centered and communicate with compassion and understanding | Jään tasakaalukakas ja suhtlen kaastunde ja mõistmisega |
| 2 | 7 | I address issues openly while respecting the other person | Käsitlen probleeme avatult, austades teist inimest |
| 3 | 5 | I become defensive or try to prove I'm right | Muutun kaitsvaks või püüan tõestada, et mul on õigus |
| 4 | 3 | I avoid conflict because I fear rejection or negative reactions | Väldin konflikti, sest kardan tagasilükkamist või negatiivseid reaktsioone |
| 5 | 1 | I withdraw completely and don't engage | Tõmbun täielikult tagasi ja ei osale |

### Question 11
**EN**: When you think about your personal growth, what resonates most?
**ET**: Kui mõtled oma isiklikule kasvule, mis resoneerib kõige rohkem?

#### Answers:
| Order | Score | English | Estonian |
|-------|-------|---------|----------|
| 1 | 9 | I feel whole and complete; growth happens naturally without striving | Tunnen end terviklikuna ja täielikuna; kasv toimub loomulikult ilma pingutamata |
| 2 | 7 | I'm actively growing and embracing new challenges with enthusiasm | Kasvan aktiivselt ja võtan uusi väljakutseid entusiasmiga vastu |
| 3 | 5 | I feel I need to achieve more to be worthy or successful | Tunnen, et pean saavutama rohkem, et olla väärikas või edukas |
| 4 | 3 | I want to grow but feel stuck or afraid to take steps | Tahan kasvada, aga tunnen end kinni jäänuna või hirmu sammusid astuda |
| 5 | 1 | Personal growth feels irrelevant or beyond my reach | Isiklik kasv tundub ebaoluline või minu haardeulatusest väljas |

### Question 12
**EN**: How connected do you feel to a sense of purpose or meaning in your life?
**ET**: Kui ühenduses tunned end eesmärgi või tähenduse tajumisega oma elus?

#### Answers:
| Order | Score | English | Estonian |
|-------|-------|---------|----------|
| 1 | 9 | I feel deeply connected to purpose; life itself feels meaningful | Tunnen sügavat ühendust eesmärgiga; elu ise tundub tähendusrikas |
| 2 | 7 | I have clear purposes that give my life direction and fulfillment | Mul on selged eesmärgid, mis annavad mu elule suuna ja täitmise |
| 3 | 5 | My sense of purpose is tied to external achievements or recognition | Mu eesmärgitunne on seotud väliste saavutuste või tunnustusega |
| 4 | 3 | I search for meaning but often feel uncertain or confused | Otsin tähendust, aga tunnen end sageli ebakindla või segaduses |
| 5 | 1 | Life feels meaningless; I struggle to find any purpose | Elu tundub mõttetu; mul on raske leida mingit eesmärki |

---

## Result Levels (Database Schema)

Result levels are stored in `quiz_result_levels` table with these score ranges:

| min_score | max_score | Level | Title (EN) | Title (ET) |
|-----------|-----------|-------|------------|------------|
| 12 | 15 | 1 | Seeking Inner Pause | Sisemise pausi otsimine |
| 16 | 27 | 2 | Processing Life's Weight | Elu raskuse töötlemine |
| 28 | 39 | 3 | Navigating Uncertainty | Ebakindluses navigeerimine |
| 40 | 51 | 4 | Driven by Desire | Iha ajendatud |
| 52 | 63 | 5 | The Friction Point | Hõõrdepunkt |
| 64 | 75 | 6 | Seeking Recognition | Tunnustuse otsimine |
| 76 | 87 | 7 | Stepping Into Courage | Julgusse astumine |
| 88 | 99 | 8 | Embracing What Is | Selle omaksvõtmine, mis on |
| 100 | 108 | 9 | Inner Peace Realized | Sisemine rahu saavutatud |

---

## Database Structure

### Quiz Table (`quizzes`)
```sql
-- Emotional quiz uses quiz_type = 'emotional'
INSERT INTO quizzes (
  slug,
  title,
  description,
  quiz_type,
  enable_scoring,
  shuffle_questions,
  shuffle_answers,
  include_open_mindedness,
  show_confetti,
  primary_language
) VALUES (
  'emotional-state',
  '{"en": "Emotional State Assessment", "et": "Emotsionaalse seisundi hindamine"}',
  '{"en": "Discover your emotional baseline using the Sedona Method scale", "et": "Avasta oma emotsionaalne lähtepunkt Sedona meetodi skaalal"}',
  'emotional',
  true,
  false,
  false,
  false,
  true,
  'en'
);
```

### Questions Table (`quiz_questions`)
```sql
-- question_type = 'single_choice' for all emotional quiz questions
INSERT INTO quiz_questions (quiz_id, question_order, question_text, question_type)
VALUES (
  '<quiz_id>',
  1,
  '{"en": "When you think about your current life situation...", "et": "Kui mõtled oma praegusele eluolukorrale..."}',
  'single_choice'
);
```

### Answers Table (`quiz_answers`)
```sql
-- score_value: 1, 3, 5, 7, or 9
INSERT INTO quiz_answers (question_id, answer_order, answer_text, score_value)
VALUES (
  '<question_id>',
  1,
  '{"en": "I feel a sense of inner stillness...", "et": "Tunnen sisemist vaikust..."}',
  9
);
```

### Result Levels Table (`quiz_result_levels`)
```sql
INSERT INTO quiz_result_levels (
  quiz_id,
  min_score,
  max_score,
  title,
  description,
  insights,
  emoji,
  color_class
) VALUES (
  '<quiz_id>',
  100, -- min: 12 questions × ~8.3 avg
  108, -- max: 12 questions × 9
  '{"en": "Inner Peace Realized", "et": "Sisemine rahu saavutatud"}',
  '{"en": "You are experiencing a state of deep inner peace...", "et": "Koged sügava sisemise rahu seisundit..."}',
  '[{"en": "Common experience 1", "et": "Tavaline kogemus 1"}, ...]',
  '☮️',
  'from-emerald-500 to-teal-600'
);
```

---

## UI Translation Keys

Add these to `ui_translations` table:

```typescript
const emotionalQuizTranslations = {
  // Sedona level names
  sedonaApathy: { en: "Apathy", et: "Apaatia" },
  sedonaGrief: { en: "Grief", et: "Lein" },
  sedonaFear: { en: "Fear", et: "Hirm" },
  sedonaLust: { en: "Lust", et: "Iha" },
  sedonaAnger: { en: "Anger", et: "Viha" },
  sedonaPride: { en: "Pride", et: "Uhkus" },
  sedonaCourage: { en: "Courage", et: "Julgus" },
  sedonaAcceptance: { en: "Acceptance", et: "Aktsepteerimine" },
  sedonaPeace: { en: "Peace", et: "Rahu" },
  
  // Sedona level descriptions
  sedonaApathyDesc: { en: "Feeling disconnected from life", et: "Tunne elust eraldatuna" },
  sedonaGriefDesc: { en: "Processing loss and sadness", et: "Kaotuse ja kurbuse töötlemine" },
  sedonaFearDesc: { en: "Experiencing worry and anxiety", et: "Mure ja ärevuse kogemine" },
  sedonaLustDesc: { en: "Driven by wanting and craving", et: "Iha ja soovide ajendatud" },
  sedonaAngerDesc: { en: "Feeling frustrated and resistant", et: "Pettumuse ja vastupanu tunne" },
  sedonaPrideDesc: { en: "Seeking validation and recognition", et: "Tunnustuse ja kinnituse otsimine" },
  sedonaCourageDesc: { en: "Willing to try and grow", et: "Valmisolek proovida ja kasvada" },
  sedonaAcceptanceDesc: { en: "At peace with what is", et: "Rahul sellega, mis on" },
  sedonaPeaceDesc: { en: "Deep inner stillness", et: "Sügav sisemine vaikus" },
  
  // Results page
  yourEmotionalProfile: { en: "Your Emotional Profile", et: "Sinu emotsionaalne profiil" },
  averageScore: { en: "Average Score", et: "Keskmine skoor" },
  levelLabel: { en: "Level", et: "Tase" },
  whatThisMeans: { en: "What This Means", et: "Mida see tähendab" },
  commonExperiences: { en: "Common Experiences", et: "Tavalised kogemused" },
  commonExperiencesDesc: { en: "People at this level often experience:", et: "Inimesed sellel tasemel kogevad sageli:" },
  pathForward: { en: "Path Forward", et: "Tee edasi" },
  pathForwardDesc: { en: "Steps to move toward higher states:", et: "Sammud kõrgemate seisundite poole liikumiseks:" },
  sedonaScaleTitle: { en: "Sedona Emotional Scale", et: "Sedona emotsionaalne skaala" },
  emotionalCtaTitle: { en: "Ready to Transform?", et: "Valmis muutuma?" },
  emotionalCtaDesc: { en: "Learn techniques to shift your emotional state", et: "Õpi tehnikaid oma emotsionaalse seisundi muutmiseks" },
  takeAssessmentAgain: { en: "Take Assessment Again", et: "Tee hindamine uuesti" },
};
```

---

## Component Logic (React/TypeScript)

```typescript
// EmotionalResultsScreen.tsx - Key calculation logic

// 1. Calculate scores
const questionCount = answers.length || 12;
const totalScore = answers.reduce((sum, a) => sum + a.score, 0); // Range: 12-108
const averageScore = totalScore / questionCount; // Range: 1-9
const emotionalLevel = Math.round(averageScore); // 1-9 integer

// 2. Find matching result level
const result = resultLevels.find(
  (level) => totalScore >= level.min_score && totalScore <= level.max_score
);

// 3. Calculate percentage for visual display
const percentage = Math.round((averageScore / 9) * 100);

// 4. Map level to Sedona name
const emotionalLevelNames: Record<number, string> = {
  1: "Apathy",
  2: "Grief", 
  3: "Fear",
  4: "Lust",
  5: "Anger",
  6: "Pride",
  7: "Courage",
  8: "Acceptance",
  9: "Peace"
};
```

---

## Full Answer Data Export

All 12 questions with 5 answers each, in both languages, with score values:

```json
{
  "questions": [
    {
      "order": 1,
      "text": {
        "en": "When you think about your current life situation, which of these best describes your inner experience?",
        "et": "Kui mõtled oma praegusele eluolukorrale, siis milline neist kirjeldab kõige paremini Sinu sisemist kogemust?"
      },
      "answers": [
        { "order": 1, "score": 9, "text": { "en": "I feel a sense of inner stillness and deep contentment with how things are", "et": "Tunnen sisemist vaikust ja sügavat rahulolu sellega, kuidas asjad on" }},
        { "order": 2, "score": 7, "text": { "en": "I'm accepting and at peace with challenges, seeing them as growth opportunities", "et": "Aktsepteerin ja olen rahul väljakutsetega, nähes neid kasvuvõimalustena" }},
        { "order": 3, "score": 5, "text": { "en": "I'm frustrated with how things are and feel driven to change them forcefully", "et": "Olen pettunud, kuidas asjad on, ja tunnen vajadust neid jõuliselt muuta" }},
        { "order": 4, "score": 3, "text": { "en": "I often worry about what might go wrong and feel anxious about the future", "et": "Muretsem sageli, mis võib valesti minna, ja tunnen ärevust tuleviku pärast" }},
        { "order": 5, "score": 1, "text": { "en": "I feel disconnected and unable to see the point in making changes", "et": "Tunnen end eraldatuna ja ei näe mõtet muudatuste tegemises" }}
      ]
    },
    {
      "order": 2,
      "text": {
        "en": "How do you typically respond to unexpected changes or setbacks?",
        "et": "Kuidas tavaliselt reageerid ootamatutele muutustele või tagasilöökidele?"
      },
      "answers": [
        { "order": 1, "score": 9, "text": { "en": "I remain calm and centered, trusting that everything will work out", "et": "Jään rahulikuks ja tasakaalukakas, usaldades, et kõik laheneb" }},
        { "order": 2, "score": 7, "text": { "en": "I adapt willingly and look for the lessons in the situation", "et": "Kohanen vabatahtlikult ja otsin olukorrast õppetunde" }},
        { "order": 3, "score": 5, "text": { "en": "I feel angry or resistant, wanting to push back against what happened", "et": "Tunnen viha või vastupanu, tahtes vastu seista sellele, mis juhtus" }},
        { "order": 4, "score": 3, "text": { "en": "I become fearful and worried about the consequences", "et": "Muutun hirmutatuks ja muretsen tagajärgede pärast" }},
        { "order": 5, "score": 1, "text": { "en": "I feel overwhelmed and tend to shut down or give up", "et": "Tunnen end ülekoormatuna ja kipun sulguma või loobuma" }}
      ]
    },
    {
      "order": 3,
      "text": {
        "en": "When thinking about your goals and ambitions, what best describes your motivation?",
        "et": "Kui mõtled oma eesmärkidele ja ambitsioonidele, mis kirjeldab kõige paremini Sinu motivatsiooni?"
      },
      "answers": [
        { "order": 1, "score": 9, "text": { "en": "I feel fulfilled already; goals arise naturally from a place of peace", "et": "Tunnen end juba täidetuna; eesmärgid tõusevad loomulikult rahu kohast" }},
        { "order": 2, "score": 7, "text": { "en": "I pursue goals with enthusiasm while being okay if things don't work out", "et": "Jälitan eesmärke entusiasmiga, olles okei, kui asjad ei õnnestu" }},
        { "order": 3, "score": 5, "text": { "en": "I need to prove myself or show others I'm successful", "et": "Pean tõestama ennast või näitama teistele, et olen edukas" }},
        { "order": 4, "score": 3, "text": { "en": "I want things intensely but often feel I can't have what I truly desire", "et": "Tahan asju intensiivselt, aga tunnen sageli, et ei saa seda, mida tõeliselt soovin" }},
        { "order": 5, "score": 1, "text": { "en": "I've lost interest in goals; nothing seems worth pursuing", "et": "Olen kaotanud huvi eesmärkide vastu; miski ei tundu jälitamist väärt" }}
      ]
    },
    {
      "order": 4,
      "text": {
        "en": "How do you relate to difficult emotions when they arise?",
        "et": "Kuidas suhtud rasketesse emotsioonidesse, kui need tõusevad?"
      },
      "answers": [
        { "order": 1, "score": 9, "text": { "en": "I observe them with compassion and let them pass naturally", "et": "Vaatlen neid kaastundega ja lasen neil loomulikult mööduda" }},
        { "order": 2, "score": 7, "text": { "en": "I acknowledge them and work through them constructively", "et": "Tunnistan neid ja töötan nendega konstruktiivselt" }},
        { "order": 3, "score": 5, "text": { "en": "I often react strongly and express my emotions outwardly", "et": "Reageerin sageli tugevalt ja väljendan oma emotsioone väliselt" }},
        { "order": 4, "score": 3, "text": { "en": "I try to suppress or avoid them because they feel too overwhelming", "et": "Püüan neid maha suruda või vältida, sest need tunduvad liiga ülekaalukad" }},
        { "order": 5, "score": 1, "text": { "en": "I feel numb or disconnected from my emotions most of the time", "et": "Tunnen end tuimana või emotsioonidest eraldatuna enamuse ajast" }}
      ]
    },
    {
      "order": 5,
      "text": {
        "en": "How would you describe your general energy levels throughout the day?",
        "et": "Kuidas kirjeldaksid oma üldist energiataset päeva jooksul?"
      },
      "answers": [
        { "order": 1, "score": 9, "text": { "en": "I feel naturally energized and peaceful, without needing external stimulation", "et": "Tunnen end loomulikult energilise ja rahulikuna, ilma välise stimulatsioonita" }},
        { "order": 2, "score": 7, "text": { "en": "I have good energy and actively engage with life's activities", "et": "Mul on hea energia ja tegelen aktiivselt elu tegevustega" }},
        { "order": 3, "score": 5, "text": { "en": "My energy fluctuates based on whether things are going my way", "et": "Mu energia kõigub sõltuvalt sellest, kas asjad lähevad minu tahtmist mööda" }},
        { "order": 4, "score": 3, "text": { "en": "I often feel drained by worry or anxious thoughts", "et": "Tunnen end sageli kurnatuna murest või ärevatest mõtetest" }},
        { "order": 5, "score": 1, "text": { "en": "I struggle to find energy for even basic daily activities", "et": "Mul on raske leida energiat isegi põhilisteks igapäevategevusteks" }}
      ]
    },
    {
      "order": 6,
      "text": {
        "en": "How do you typically view other people?",
        "et": "Kuidas tavaliselt vaatad teisi inimesi?"
      },
      "answers": [
        { "order": 1, "score": 9, "text": { "en": "I see everyone as inherently valuable and feel connected to others", "et": "Näen kõiki kui olemuslikult väärtuslikke ja tunnen ühendust teistega" }},
        { "order": 2, "score": 7, "text": { "en": "I appreciate people for who they are, including their flaws", "et": "Hindan inimesi selle eest, kes nad on, kaasa arvatud nende vead" }},
        { "order": 3, "score": 5, "text": { "en": "I sometimes compare myself to others or feel competitive", "et": "Võrdlen end mõnikord teistega või tunnen konkurentsi" }},
        { "order": 4, "score": 3, "text": { "en": "I often feel threatened or intimidated by certain people", "et": "Tunnen end sageli ohustatuna või hirmutatud teatud inimeste poolt" }},
        { "order": 5, "score": 1, "text": { "en": "I feel isolated and struggle to connect with anyone", "et": "Tunnen end isoleerituna ja mul on raske kellegagi ühendust luua" }}
      ]
    },
    {
      "order": 7,
      "text": {
        "en": "When you make a mistake or fail at something, how do you typically respond?",
        "et": "Kui teed vea või ebaõnnestud milleski, kuidas tavaliselt reageerid?"
      },
      "answers": [
        { "order": 1, "score": 9, "text": { "en": "I accept it with equanimity and move forward without self-judgment", "et": "Aktsepteerin seda tasakaalukalt ja liigun edasi ilma enesehinnangu andmiseta" }},
        { "order": 2, "score": 7, "text": { "en": "I learn from it and try again with a positive attitude", "et": "Õpin sellest ja proovin uuesti positiivse suhtumisega" }},
        { "order": 3, "score": 5, "text": { "en": "I get frustrated with myself or blame external circumstances", "et": "Pettun endas või süüdistan väliseid asjaolusid" }},
        { "order": 4, "score": 3, "text": { "en": "I feel deeply sad or disappointed, sometimes for extended periods", "et": "Tunnen end sügavalt kurvana või pettununa, mõnikord pikka aega" }},
        { "order": 5, "score": 1, "text": { "en": "I use it as confirmation that trying is pointless", "et": "Kasutan seda kinnitusena, et proovimine on mõttetu" }}
      ]
    },
    {
      "order": 8,
      "text": {
        "en": "How do you feel about the future?",
        "et": "Kuidas suhtud tulevikku?"
      },
      "answers": [
        { "order": 1, "score": 9, "text": { "en": "I trust that life will unfold perfectly, regardless of specifics", "et": "Usaldan, et elu areneb ideaalselt, olenemata üksikasjadest" }},
        { "order": 2, "score": 7, "text": { "en": "I feel optimistic and look forward to what's ahead", "et": "Tunnen end optimistlikuna ja ootan, mis ees on" }},
        { "order": 3, "score": 5, "text": { "en": "I feel I need to control outcomes to ensure a good future", "et": "Tunnen, et pean kontrollima tulemusi, et tagada hea tulevik" }},
        { "order": 4, "score": 3, "text": { "en": "I often worry about what might go wrong", "et": "Muretsem sageli, mis võib valesti minna" }},
        { "order": 5, "score": 1, "text": { "en": "The future feels hopeless or meaningless to me", "et": "Tulevik tundub mulle lootusetu või mõttetu" }}
      ]
    },
    {
      "order": 9,
      "text": {
        "en": "How do you experience satisfaction in your daily life?",
        "et": "Kuidas koged rahulolu oma igapäevaelus?"
      },
      "answers": [
        { "order": 1, "score": 9, "text": { "en": "I feel deeply content with simple moments and everyday experiences", "et": "Tunnen sügavat rahulolu lihtsate hetkedega ja igapäevaste kogemustega" }},
        { "order": 2, "score": 7, "text": { "en": "I find joy in many activities and relationships", "et": "Leian rõõmu paljudest tegevustest ja suhetest" }},
        { "order": 3, "score": 5, "text": { "en": "Satisfaction depends on achieving specific goals or outcomes", "et": "Rahulolu sõltub konkreetsete eesmärkide või tulemuste saavutamisest" }},
        { "order": 4, "score": 3, "text": { "en": "I often feel something is missing even when things are going well", "et": "Tunnen sageli, et midagi on puudu, isegi kui asjad lähevad hästi" }},
        { "order": 5, "score": 1, "text": { "en": "I rarely experience satisfaction or pleasure in anything", "et": "Kogen harva rahulolu või naudingut milleski" }}
      ]
    },
    {
      "order": 10,
      "text": {
        "en": "How do you typically handle conflict in relationships?",
        "et": "Kuidas tavaliselt käitled konflikte suhetes?"
      },
      "answers": [
        { "order": 1, "score": 9, "text": { "en": "I remain centered and communicate with compassion and understanding", "et": "Jään tasakaalukakas ja suhtlen kaastunde ja mõistmisega" }},
        { "order": 2, "score": 7, "text": { "en": "I address issues openly while respecting the other person", "et": "Käsitlen probleeme avatult, austades teist inimest" }},
        { "order": 3, "score": 5, "text": { "en": "I become defensive or try to prove I'm right", "et": "Muutun kaitsvaks või püüan tõestada, et mul on õigus" }},
        { "order": 4, "score": 3, "text": { "en": "I avoid conflict because I fear rejection or negative reactions", "et": "Väldin konflikti, sest kardan tagasilükkamist või negatiivseid reaktsioone" }},
        { "order": 5, "score": 1, "text": { "en": "I withdraw completely and don't engage", "et": "Tõmbun täielikult tagasi ja ei osale" }}
      ]
    },
    {
      "order": 11,
      "text": {
        "en": "When you think about your personal growth, what resonates most?",
        "et": "Kui mõtled oma isiklikule kasvule, mis resoneerib kõige rohkem?"
      },
      "answers": [
        { "order": 1, "score": 9, "text": { "en": "I feel whole and complete; growth happens naturally without striving", "et": "Tunnen end terviklikuna ja täielikuna; kasv toimub loomulikult ilma pingutamata" }},
        { "order": 2, "score": 7, "text": { "en": "I'm actively growing and embracing new challenges with enthusiasm", "et": "Kasvan aktiivselt ja võtan uusi väljakutseid entusiasmiga vastu" }},
        { "order": 3, "score": 5, "text": { "en": "I feel I need to achieve more to be worthy or successful", "et": "Tunnen, et pean saavutama rohkem, et olla väärikas või edukas" }},
        { "order": 4, "score": 3, "text": { "en": "I want to grow but feel stuck or afraid to take steps", "et": "Tahan kasvada, aga tunnen end kinni jäänuna või hirmu sammusid astuda" }},
        { "order": 5, "score": 1, "text": { "en": "Personal growth feels irrelevant or beyond my reach", "et": "Isiklik kasv tundub ebaoluline või minu haardeulatusest väljas" }}
      ]
    },
    {
      "order": 12,
      "text": {
        "en": "How connected do you feel to a sense of purpose or meaning in your life?",
        "et": "Kui ühenduses tunned end eesmärgi või tähenduse tajumisega oma elus?"
      },
      "answers": [
        { "order": 1, "score": 9, "text": { "en": "I feel deeply connected to purpose; life itself feels meaningful", "et": "Tunnen sügavat ühendust eesmärgiga; elu ise tundub tähendusrikas" }},
        { "order": 2, "score": 7, "text": { "en": "I have clear purposes that give my life direction and fulfillment", "et": "Mul on selged eesmärgid, mis annavad mu elule suuna ja täitmise" }},
        { "order": 3, "score": 5, "text": { "en": "My sense of purpose is tied to external achievements or recognition", "et": "Mu eesmärgitunne on seotud väliste saavutuste või tunnustusega" }},
        { "order": 4, "score": 3, "text": { "en": "I search for meaning but often feel uncertain or confused", "et": "Otsin tähendust, aga tunnen end sageli ebakindla või segaduses" }},
        { "order": 5, "score": 1, "text": { "en": "Life feels meaningless; I struggle to find any purpose", "et": "Elu tundub mõttetu; mul on raske leida mingit eesmärki" }}
      ]
    }
  ]
}
```

---

## Notes

1. **Score Range**: Each answer scores 1, 3, 5, 7, or 9 (odd numbers only, matching Sedona levels)
2. **Total Score**: 12 questions × score = range 12-108
3. **Display**: Show average (1-9 scale) to users, store total in database
4. **Result Matching**: Use total score ranges in `quiz_result_levels` table
5. **Insights**: Store 4 insights per level - first 2 are "Common Experiences", last 2 are "Path Forward"
