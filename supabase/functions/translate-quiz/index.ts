import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARGET_LANGUAGES = [
  { code: "hr", name: "Croatian" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "sl", name: "Slovenian" },
];

// Add Estonian as target when source is English, and vice versa
function getTargetLanguages(sourceLanguage: string) {
  const targets = [...TARGET_LANGUAGES];
  if (sourceLanguage === "en") {
    targets.push({ code: "et", name: "Estonian" });
  } else if (sourceLanguage === "et") {
    targets.push({ code: "en", name: "English" });
  }
  return targets;
}

interface TranslateRequest {
  quizId: string;
  sourceLanguage: string;
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
    console.log(`Starting translation for quiz ${quizId} from ${sourceLanguage}`);

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
    
    // Collect all texts to translate
    const textsToTranslate: { path: string; text: string }[] = [];
    
    // Quiz fields
    const quizFields = ["title", "description", "headline", "headline_highlight", "badge_text", "cta_text", "duration_text"];
    for (const field of quizFields) {
      const value = quiz[field]?.[sourceLanguage];
      if (value) {
        textsToTranslate.push({ path: `quiz.${field}`, text: value });
      }
    }

    // Discover items (array of strings)
    const discoverItems = quiz.discover_items?.[sourceLanguage] || [];
    if (Array.isArray(discoverItems)) {
      discoverItems.forEach((item: string, idx: number) => {
        if (item) textsToTranslate.push({ path: `quiz.discover_items.${idx}`, text: item });
      });
    }

    // Questions
    (questions || []).forEach((q, qIdx) => {
      const qText = q.question_text?.[sourceLanguage];
      if (qText) textsToTranslate.push({ path: `question.${q.id}`, text: qText });
    });

    // Answers
    (answers || []).forEach((a) => {
      const aText = a.answer_text?.[sourceLanguage];
      if (aText) textsToTranslate.push({ path: `answer.${a.id}`, text: aText });
    });

    // Result levels
    (resultLevels || []).forEach((rl) => {
      const title = rl.title?.[sourceLanguage];
      const desc = rl.description?.[sourceLanguage];
      if (title) textsToTranslate.push({ path: `result.${rl.id}.title`, text: title });
      if (desc) textsToTranslate.push({ path: `result.${rl.id}.description`, text: desc });
      
      // Insights array
      const insights = rl.insights?.[sourceLanguage] || [];
      if (Array.isArray(insights)) {
        insights.forEach((insight: string, idx: number) => {
          if (insight) textsToTranslate.push({ path: `result.${rl.id}.insights.${idx}`, text: insight });
        });
      }
    });

    if (textsToTranslate.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No texts to translate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${textsToTranslate.length} texts to translate to ${targetLanguages.length} languages`);

    // Translate to each target language
    const translations: Record<string, Record<string, string>> = {};
    
    for (const lang of targetLanguages) {
      console.log(`Translating to ${lang.name}...`);
      
      const prompt = `You are a professional translator. Translate the following texts from ${sourceLanguage === "en" ? "English" : "Estonian"} to ${lang.name}.

Return ONLY a JSON object where keys are the original text paths and values are the translations.
Keep the translations natural and appropriate for a professional quiz/assessment context.
Maintain any formatting, emojis, or special characters.

Texts to translate:
${JSON.stringify(textsToTranslate.map(t => ({ path: t.path, text: t.text })), null, 2)}`;

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
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Translation API error for ${lang.code}:`, errorText);
        continue;
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || "";
      
      // Clean up markdown code blocks if present
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      try {
        const parsed = JSON.parse(content);
        translations[lang.code] = {};
        
        for (const item of textsToTranslate) {
          const translated = parsed[item.path];
          if (translated) {
            translations[lang.code][item.path] = translated;
          }
        }
        console.log(`Got ${Object.keys(translations[lang.code]).length} translations for ${lang.code}`);
      } catch (parseError) {
        console.error(`Failed to parse translations for ${lang.code}:`, parseError);
      }
    }

    // Apply translations to database
    console.log("Applying translations to database...");

    // Update quiz
    const updatedQuiz: Record<string, any> = {};
    for (const field of quizFields) {
      const currentValue = quiz[field] || {};
      for (const lang of targetLanguages) {
        const translated = translations[lang.code]?.[`quiz.${field}`];
        if (translated) {
          currentValue[lang.code] = translated;
        }
      }
      updatedQuiz[field] = currentValue;
    }

    // Handle discover_items
    const updatedDiscoverItems = quiz.discover_items || {};
    for (const lang of targetLanguages) {
      const items: string[] = [];
      let idx = 0;
      while (translations[lang.code]?.[`quiz.discover_items.${idx}`]) {
        items.push(translations[lang.code][`quiz.discover_items.${idx}`]);
        idx++;
      }
      if (items.length > 0) {
        updatedDiscoverItems[lang.code] = items;
      }
    }
    updatedQuiz.discover_items = updatedDiscoverItems;

    await supabase.from("quizzes").update(updatedQuiz).eq("id", quizId);

    // Update questions
    for (const q of questions || []) {
      const currentText = q.question_text || {};
      for (const lang of targetLanguages) {
        const translated = translations[lang.code]?.[`question.${q.id}`];
        if (translated) {
          currentText[lang.code] = translated;
        }
      }
      await supabase.from("quiz_questions").update({ question_text: currentText }).eq("id", q.id);
    }

    // Update answers
    for (const a of answers || []) {
      const currentText = a.answer_text || {};
      for (const lang of targetLanguages) {
        const translated = translations[lang.code]?.[`answer.${a.id}`];
        if (translated) {
          currentText[lang.code] = translated;
        }
      }
      await supabase.from("quiz_answers").update({ answer_text: currentText }).eq("id", a.id);
    }

    // Update result levels
    for (const rl of resultLevels || []) {
      const currentTitle = rl.title || {};
      const currentDesc = rl.description || {};
      const currentInsights = rl.insights || {};

      for (const lang of targetLanguages) {
        const translatedTitle = translations[lang.code]?.[`result.${rl.id}.title`];
        const translatedDesc = translations[lang.code]?.[`result.${rl.id}.description`];
        
        if (translatedTitle) currentTitle[lang.code] = translatedTitle;
        if (translatedDesc) currentDesc[lang.code] = translatedDesc;

        // Handle insights array
        const insights: string[] = [];
        let idx = 0;
        while (translations[lang.code]?.[`result.${rl.id}.insights.${idx}`]) {
          insights.push(translations[lang.code][`result.${rl.id}.insights.${idx}`]);
          idx++;
        }
        if (insights.length > 0) {
          currentInsights[lang.code] = insights;
        }
      }

      await supabase.from("quiz_result_levels").update({
        title: currentTitle,
        description: currentDesc,
        insights: currentInsights,
      }).eq("id", rl.id);
    }

    console.log("Translation complete!");

    return new Response(JSON.stringify({ 
      success: true, 
      translatedLanguages: targetLanguages.map(l => l.code),
      textCount: textsToTranslate.length 
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