import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { quizSlug } = await req.json();
    console.log(`Starting Estonian to English translation for hypothesis quiz: ${quizSlug}`);

    // Get quiz ID
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id")
      .eq("slug", quizSlug)
      .single();

    if (quizError || !quiz) {
      throw new Error(`Quiz not found: ${quizSlug}`);
    }

    // Fetch hypothesis pages
    const { data: pages } = await supabase
      .from("hypothesis_pages")
      .select("*")
      .eq("quiz_id", quiz.id)
      .order("page_number");

    // Fetch hypothesis questions
    const { data: questions } = await supabase
      .from("hypothesis_questions")
      .select("*")
      .in("page_id", (pages || []).map(p => p.id))
      .order("question_order");

    console.log(`Found ${pages?.length || 0} pages and ${questions?.length || 0} questions`);

    // Collect all texts to translate
    const textsToTranslate: { id: string; type: string; field: string; text: string }[] = [];

    // Pages
    for (const page of pages || []) {
      if (page.title?.et && !page.title?.en) {
        textsToTranslate.push({ id: page.id, type: "page", field: "title", text: page.title.et });
      }
      if (page.description?.et && !page.description?.en) {
        textsToTranslate.push({ id: page.id, type: "page", field: "description", text: page.description.et });
      }
    }

    // Questions
    for (const q of questions || []) {
      // hypothesis_text_man
      if (q.hypothesis_text_man?.et && !q.hypothesis_text_man?.en) {
        textsToTranslate.push({ id: q.id, type: "question", field: "hypothesis_text_man", text: q.hypothesis_text_man.et });
      }
      // hypothesis_text_woman
      if (q.hypothesis_text_woman?.et && !q.hypothesis_text_woman?.en) {
        textsToTranslate.push({ id: q.id, type: "question", field: "hypothesis_text_woman", text: q.hypothesis_text_woman.et });
      }
      // interview_question
      if (q.interview_question?.et && !q.interview_question?.en) {
        textsToTranslate.push({ id: q.id, type: "question", field: "interview_question", text: q.interview_question.et });
      }
      // truth_explanation
      if (q.truth_explanation?.et && !q.truth_explanation?.en) {
        textsToTranslate.push({ id: q.id, type: "question", field: "truth_explanation", text: q.truth_explanation.et });
      }
    }

    if (textsToTranslate.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "All content already has English translations",
        translatedCount: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${textsToTranslate.length} texts to translate from Estonian to English`);

    // Batch translate
    const prompt = `You are a professional translator. Translate the following texts from Estonian to English.
These are for a bias assessment quiz about 50+ employees.
Return ONLY a JSON array with the same structure, where each item has id, type, field, and translation (the English translation).
Keep translations natural, professional, and concise.

Texts to translate:
${JSON.stringify(textsToTranslate, null, 2)}`;

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
      console.error("Translation API error:", errorText);
      throw new Error("Translation API failed");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let translations: { id: string; type: string; field: string; translation: string }[];
    try {
      translations = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse translations:", content);
      throw new Error("Failed to parse translation response");
    }

    console.log(`Received ${translations.length} translations`);

    // Apply translations to database
    let updatedPages = 0;
    let updatedQuestions = 0;

    // Group translations by id and type
    const pageUpdates: Record<string, Record<string, string>> = {};
    const questionUpdates: Record<string, Record<string, string>> = {};

    for (const t of translations) {
      if (t.type === "page") {
        if (!pageUpdates[t.id]) pageUpdates[t.id] = {};
        pageUpdates[t.id][t.field] = t.translation;
      } else if (t.type === "question") {
        if (!questionUpdates[t.id]) questionUpdates[t.id] = {};
        questionUpdates[t.id][t.field] = t.translation;
      }
    }

    // Update pages
    for (const [pageId, fields] of Object.entries(pageUpdates)) {
      const page = pages?.find(p => p.id === pageId);
      if (!page) continue;

      const update: Record<string, any> = {};
      if (fields.title) {
        update.title = { ...page.title, en: fields.title };
      }
      if (fields.description) {
        update.description = { ...page.description, en: fields.description };
      }

      if (Object.keys(update).length > 0) {
        await supabase.from("hypothesis_pages").update(update).eq("id", pageId);
        updatedPages++;
      }
    }

    // Update questions
    for (const [questionId, fields] of Object.entries(questionUpdates)) {
      const question = questions?.find(q => q.id === questionId);
      if (!question) continue;

      const update: Record<string, any> = {};
      if (fields.hypothesis_text_man) {
        update.hypothesis_text_man = { ...question.hypothesis_text_man, en: fields.hypothesis_text_man };
      }
      if (fields.hypothesis_text_woman) {
        update.hypothesis_text_woman = { ...question.hypothesis_text_woman, en: fields.hypothesis_text_woman };
      }
      if (fields.interview_question) {
        update.interview_question = { ...question.interview_question, en: fields.interview_question };
      }
      if (fields.truth_explanation) {
        update.truth_explanation = { ...question.truth_explanation, en: fields.truth_explanation };
      }

      if (Object.keys(update).length > 0) {
        await supabase.from("hypothesis_questions").update(update).eq("id", questionId);
        updatedQuestions++;
      }
    }

    console.log(`Translation complete! Updated ${updatedPages} pages and ${updatedQuestions} questions`);

    return new Response(JSON.stringify({ 
      success: true, 
      translatedCount: translations.length,
      updatedPages,
      updatedQuestions,
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
