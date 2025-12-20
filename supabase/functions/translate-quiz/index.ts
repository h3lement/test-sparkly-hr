import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// All supported target languages (EU languages as requested)
const ALL_TARGET_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "et", name: "Estonian" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "it", name: "Italian" },
  { code: "es", name: "Spanish" },
  { code: "pl", name: "Polish" },
  { code: "ro", name: "Romanian" },
  { code: "nl", name: "Dutch" },
  { code: "el", name: "Greek" },
  { code: "pt", name: "Portuguese" },
  { code: "cs", name: "Czech" },
  { code: "hu", name: "Hungarian" },
  { code: "sv", name: "Swedish" },
  { code: "bg", name: "Bulgarian" },
  { code: "da", name: "Danish" },
  { code: "fi", name: "Finnish" },
  { code: "sk", name: "Slovak" },
  { code: "hr", name: "Croatian" },
  { code: "lt", name: "Lithuanian" },
  { code: "sl", name: "Slovenian" },
  { code: "lv", name: "Latvian" },
  { code: "ga", name: "Irish" },
  { code: "mt", name: "Maltese" },
];

// Cost per 1K tokens (approximate for gemini-2.5-flash)
const COST_PER_1K_INPUT_TOKENS = 0.000075;
const COST_PER_1K_OUTPUT_TOKENS = 0.0003;

// Simple hash function for change detection
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Get target languages (exclude source language)
function getTargetLanguages(sourceLanguage: string) {
  return ALL_TARGET_LANGUAGES.filter(l => l.code !== sourceLanguage);
}

interface TranslateRequest {
  quizId: string;
  sourceLanguage: string;
}

interface TranslationMeta {
  source_hashes?: Record<string, string>;
  translations?: Record<string, {
    translated_at: string;
    field_hashes: Record<string, string>;
    is_complete: boolean;
  }>;
  total_cost_usd?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { quizId, sourceLanguage }: TranslateRequest = await req.json();
    console.log(`Starting smart translation for quiz ${quizId} from ${sourceLanguage}`);

    // Fetch quiz data
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      throw new Error("Quiz not found");
    }

    // Fetch questions with answers
    const { data: questions } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("question_order");

    const { data: answers } = await supabase
      .from("quiz_answers")
      .select("*")
      .in("question_id", (questions || []).map(q => q.id));

    // Fetch result levels
    const { data: resultLevels } = await supabase
      .from("quiz_result_levels")
      .select("*")
      .eq("quiz_id", quizId);

    const targetLanguages = getTargetLanguages(sourceLanguage);
    
    // Get existing translation metadata
    const existingMeta: TranslationMeta = quiz.translation_meta || {};
    const existingSourceHashes = existingMeta.source_hashes || {};
    const existingTranslations = existingMeta.translations || {};
    
    // Collect all texts and compute current hashes
    const allTexts: { path: string; text: string; hash: string }[] = [];
    
    // Quiz fields
    const quizFields = ["title", "description", "headline", "headline_highlight", "badge_text", "cta_text", "duration_text"];
    for (const field of quizFields) {
      const value = quiz[field]?.[sourceLanguage];
      if (value) {
        allTexts.push({ path: `quiz.${field}`, text: value, hash: simpleHash(value) });
      }
    }

    // Discover items (array of strings)
    const discoverItems = quiz.discover_items?.[sourceLanguage] || [];
    if (Array.isArray(discoverItems)) {
      discoverItems.forEach((item: string, idx: number) => {
        if (item) {
          allTexts.push({ path: `quiz.discover_items.${idx}`, text: item, hash: simpleHash(item) });
        }
      });
    }

    // Questions
    (questions || []).forEach((q) => {
      const qText = q.question_text?.[sourceLanguage];
      if (qText) {
        allTexts.push({ path: `question.${q.id}`, text: qText, hash: simpleHash(qText) });
      }
    });

    // Answers
    (answers || []).forEach((a) => {
      const aText = a.answer_text?.[sourceLanguage];
      if (aText) {
        allTexts.push({ path: `answer.${a.id}`, text: aText, hash: simpleHash(aText) });
      }
    });

    // Result levels
    (resultLevels || []).forEach((rl) => {
      const title = rl.title?.[sourceLanguage];
      const desc = rl.description?.[sourceLanguage];
      if (title) allTexts.push({ path: `result.${rl.id}.title`, text: title, hash: simpleHash(title) });
      if (desc) allTexts.push({ path: `result.${rl.id}.description`, text: desc, hash: simpleHash(desc) });
      
      // Insights array
      const insights = rl.insights?.[sourceLanguage] || [];
      if (Array.isArray(insights)) {
        insights.forEach((insight: string, idx: number) => {
          if (insight) {
            allTexts.push({ path: `result.${rl.id}.insights.${idx}`, text: insight, hash: simpleHash(insight) });
          }
        });
      }
    });

    if (allTexts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No texts to translate", cost: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build current source hashes
    const currentSourceHashes: Record<string, string> = {};
    for (const item of allTexts) {
      currentSourceHashes[item.path] = item.hash;
    }

    // Determine what needs translation per language
    const translationPlan: Record<string, { path: string; text: string }[]> = {};
    let totalTextsToTranslate = 0;

    for (const lang of targetLanguages) {
      const langMeta = existingTranslations[lang.code];
      const textsForLang: { path: string; text: string }[] = [];
      
      for (const item of allTexts) {
        const previousHash = langMeta?.field_hashes?.[item.path];
        // Translate if: no previous translation OR source text changed
        if (!previousHash || previousHash !== item.hash) {
          textsForLang.push({ path: item.path, text: item.text });
        }
      }
      
      if (textsForLang.length > 0) {
        translationPlan[lang.code] = textsForLang;
        totalTextsToTranslate += textsForLang.length;
      }
    }

    console.log(`Smart translation: ${totalTextsToTranslate} texts need translation across ${Object.keys(translationPlan).length} languages`);
    console.log(`Skipped: ${(allTexts.length * targetLanguages.length) - totalTextsToTranslate} texts already translated`);

    if (totalTextsToTranslate === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "All translations are up to date",
        translatedCount: 0,
        skippedCount: allTexts.length * targetLanguages.length,
        cost: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Translate only changed texts
    const translations: Record<string, Record<string, string>> = {};
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    
    for (const [langCode, textsToTranslate] of Object.entries(translationPlan)) {
      const lang = targetLanguages.find(l => l.code === langCode)!;
      console.log(`Translating ${textsToTranslate.length} texts to ${lang.name}...`);
      
      const prompt = `You are a professional translator. Translate the following texts from ${sourceLanguage === "en" ? "English" : "Estonian"} to ${lang.name}.

Return ONLY a JSON object where keys are the original text paths and values are the translations.
Keep the translations natural and appropriate for a professional quiz/assessment context.
Maintain any formatting, emojis, or special characters.

Texts to translate:
${JSON.stringify(textsToTranslate.map(t => ({ path: t.path, text: t.text })), null, 2)}`;

      // Estimate input tokens (rough: 4 chars per token)
      const inputTokenEstimate = Math.ceil(prompt.length / 4);
      totalInputTokens += inputTokenEstimate;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a precise translator. Return only valid JSON without markdown formatting." },
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Translation API error for ${langCode}:`, errorText);
        continue;
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || "";
      
      // Estimate output tokens
      const outputTokenEstimate = Math.ceil(content.length / 4);
      totalOutputTokens += outputTokenEstimate;
      
      // Clean up markdown code blocks if present
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      try {
        const parsed = JSON.parse(content);
        translations[langCode] = {};
        
        for (const item of textsToTranslate) {
          const translated = parsed[item.path];
          if (translated) {
            translations[langCode][item.path] = translated;
          }
        }
        console.log(`Got ${Object.keys(translations[langCode]).length} translations for ${langCode}`);
      } catch (parseError) {
        console.error(`Failed to parse translations for ${langCode}:`, parseError);
      }
    }

    // Calculate cost
    const sessionCost = (totalInputTokens / 1000 * COST_PER_1K_INPUT_TOKENS) + 
                        (totalOutputTokens / 1000 * COST_PER_1K_OUTPUT_TOKENS);
    const newTotalCost = (existingMeta.total_cost_usd || 0) + sessionCost;
    
    console.log(`Session cost: $${sessionCost.toFixed(6)}, Total accumulated: $${newTotalCost.toFixed(6)}`);

    // Apply translations to database
    console.log("Applying translations to database...");

    // Update quiz
    const updatedQuiz: Record<string, any> = {};
    for (const field of quizFields) {
      const currentValue = quiz[field] || {};
      for (const langCode of Object.keys(translations)) {
        const translated = translations[langCode]?.[`quiz.${field}`];
        if (translated) {
          currentValue[langCode] = translated;
        }
      }
      updatedQuiz[field] = currentValue;
    }

    // Handle discover_items
    const updatedDiscoverItems = quiz.discover_items || {};
    for (const langCode of Object.keys(translations)) {
      const items: string[] = [];
      let idx = 0;
      while (translations[langCode]?.[`quiz.discover_items.${idx}`]) {
        items.push(translations[langCode][`quiz.discover_items.${idx}`]);
        idx++;
      }
      if (items.length > 0) {
        updatedDiscoverItems[langCode] = items;
      }
    }
    updatedQuiz.discover_items = updatedDiscoverItems;

    // Update translation metadata
    const newTranslationMeta: TranslationMeta = {
      source_hashes: currentSourceHashes,
      translations: { ...existingTranslations },
      total_cost_usd: newTotalCost,
    };

    // Update per-language translation info
    const now = new Date().toISOString();
    for (const langCode of Object.keys(translations)) {
      const existingLangMeta = existingTranslations[langCode] || { field_hashes: {} };
      newTranslationMeta.translations![langCode] = {
        translated_at: now,
        field_hashes: {
          ...existingLangMeta.field_hashes,
          // Update hashes for newly translated fields
          ...Object.fromEntries(
            Object.keys(translations[langCode]).map(path => [
              path,
              currentSourceHashes[path]
            ])
          ),
        },
        is_complete: Object.keys(translations[langCode]).length === allTexts.length ||
                     (existingLangMeta.is_complete && translationPlan[langCode]?.length === Object.keys(translations[langCode]).length),
      };
    }

    updatedQuiz.translation_meta = newTranslationMeta;
    await supabase.from("quizzes").update(updatedQuiz).eq("id", quizId);

    // Update questions
    for (const q of questions || []) {
      const currentText = q.question_text || {};
      let hasUpdate = false;
      for (const langCode of Object.keys(translations)) {
        const translated = translations[langCode]?.[`question.${q.id}`];
        if (translated) {
          currentText[langCode] = translated;
          hasUpdate = true;
        }
      }
      if (hasUpdate) {
        await supabase.from("quiz_questions").update({ question_text: currentText }).eq("id", q.id);
      }
    }

    // Update answers
    for (const a of answers || []) {
      const currentText = a.answer_text || {};
      let hasUpdate = false;
      for (const langCode of Object.keys(translations)) {
        const translated = translations[langCode]?.[`answer.${a.id}`];
        if (translated) {
          currentText[langCode] = translated;
          hasUpdate = true;
        }
      }
      if (hasUpdate) {
        await supabase.from("quiz_answers").update({ answer_text: currentText }).eq("id", a.id);
      }
    }

    // Update result levels
    for (const rl of resultLevels || []) {
      const currentTitle = rl.title || {};
      const currentDesc = rl.description || {};
      const currentInsights = rl.insights || {};
      let hasUpdate = false;

      for (const langCode of Object.keys(translations)) {
        const translatedTitle = translations[langCode]?.[`result.${rl.id}.title`];
        const translatedDesc = translations[langCode]?.[`result.${rl.id}.description`];
        
        if (translatedTitle) { currentTitle[langCode] = translatedTitle; hasUpdate = true; }
        if (translatedDesc) { currentDesc[langCode] = translatedDesc; hasUpdate = true; }

        // Handle insights array
        const insights: string[] = [];
        let idx = 0;
        while (translations[langCode]?.[`result.${rl.id}.insights.${idx}`]) {
          insights.push(translations[langCode][`result.${rl.id}.insights.${idx}`]);
          idx++;
          hasUpdate = true;
        }
        if (insights.length > 0) {
          currentInsights[langCode] = insights;
        }
      }

      if (hasUpdate) {
        await supabase.from("quiz_result_levels").update({
          title: currentTitle,
          description: currentDesc,
          insights: currentInsights,
        }).eq("id", rl.id);
      }
    }

    console.log("Smart translation complete!");

    return new Response(JSON.stringify({ 
      success: true, 
      translatedLanguages: Object.keys(translations),
      translatedCount: totalTextsToTranslate,
      skippedCount: (allTexts.length * targetLanguages.length) - totalTextsToTranslate,
      sessionCost: sessionCost,
      totalCost: newTotalCost,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Translation error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
