import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// All supported target languages (EU languages + Russian/Ukrainian)
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
  { code: "ru", name: "Russian" },
  { code: "uk", name: "Ukrainian" },
];

// Cost per 1K tokens (approximate for gemini-2.5-flash)
const COST_PER_1K_INPUT_TOKENS = 0.000075;
const COST_PER_1K_OUTPUT_TOKENS = 0.0003;

function getTargetLanguages(sourceLanguage: string, selected?: string[]) {
  const allTargets = ALL_TARGET_LANGUAGES.filter((l) => l.code !== sourceLanguage);
  if (selected && selected.length > 0) {
    return allTargets.filter((l) => selected.includes(l.code));
  }
  return allTargets;
}

interface TranslateRequest {
  quizId: string;
  sourceLanguage: string;
  targetLanguages?: string[];
  regenerate?: boolean;
  model?: string;
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

    const {
      quizId,
      sourceLanguage,
      targetLanguages: selectedTargetLanguages,
      regenerate = false,
      model = "google/gemini-2.5-flash",
    }: TranslateRequest = await req.json();

    console.log(
      `Translating quiz basics (title, headline, description) for ${quizId} from ${sourceLanguage} (regenerate: ${regenerate})`,
    );

    // Fetch quiz data
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, title, description, headline, headline_highlight")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      throw new Error("Quiz not found");
    }

    const sourceTitle = quiz.title?.[sourceLanguage] || "";
    const sourceDescription = quiz.description?.[sourceLanguage] || "";
    const sourceHeadline = quiz.headline?.[sourceLanguage] || "";
    const sourceHeadlineHighlight = quiz.headline_highlight?.[sourceLanguage] || "";

    if (!sourceTitle.trim() && !sourceDescription.trim() && !sourceHeadline.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `No content found for source language ${sourceLanguage}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let targetLanguages = getTargetLanguages(sourceLanguage, selectedTargetLanguages);

    // If regenerate is false, filter out languages that already have translations
    if (!regenerate) {
      targetLanguages = targetLanguages.filter((l) => {
        const hasTitle = quiz.title?.[l.code]?.trim();
        const hasDesc = quiz.description?.[l.code]?.trim();
        const hasHeadline = quiz.headline?.[l.code]?.trim();
        // Only translate if at least one field is missing
        return !hasTitle || !hasDesc || !hasHeadline;
      });

      if (targetLanguages.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "All selected languages already have translations",
            translatedCount: 0,
            costEur: 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const sourceLangName =
      sourceLanguage === "en"
        ? "English"
        : ALL_TARGET_LANGUAGES.find((l) => l.code === sourceLanguage)?.name || sourceLanguage;

    const contentToTranslate = {
      title: sourceTitle,
      description: sourceDescription,
      headline: sourceHeadline,
      headline_highlight: sourceHeadlineHighlight,
    };

    console.log(`Translating quiz basics to ${targetLanguages.length} languages...`);

    const prompt = `You are a professional translator. Translate the following quiz content from ${sourceLangName} to these languages: ${targetLanguages.map((l) => `${l.code} (${l.name})`).join(", ")}.

Return ONLY a valid JSON object with this structure:
{
  "lang_code": {
    "title": "translated title",
    "description": "translated description",
    "headline": "translated headline",
    "headline_highlight": "translated highlight word(s)"
  },
  ...
}

Source content to translate:
${JSON.stringify(contentToTranslate, null, 2)}

Important:
- Keep translations natural and professional
- The "headline_highlight" is typically 1-2 words that should be emphasized (shown in a different color)
- Maintain the same tone and meaning
- Use proper capitalization and grammar for each language`;

    const inputTokenEstimate = Math.ceil(prompt.length / 4);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are a precise translator. Return only valid JSON without markdown formatting.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Translation API error:", errorText);
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    const outputTokenEstimate = Math.ceil(content.length / 4);
    const costUsd =
      (inputTokenEstimate / 1000) * COST_PER_1K_INPUT_TOKENS +
      (outputTokenEstimate / 1000) * COST_PER_1K_OUTPUT_TOKENS;
    const costEur = costUsd * 0.92;

    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let translations: Record<
      string,
      { title?: string; description?: string; headline?: string; headline_highlight?: string }
    >;

    try {
      translations = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse translations:", parseError);
      console.error("Content:", content);
      throw new Error("Failed to parse AI response");
    }

    // Merge translations with existing data
    const updatedTitle: Record<string, string> = { ...(quiz.title || {}) };
    const updatedDescription: Record<string, string> = { ...(quiz.description || {}) };
    const updatedHeadline: Record<string, string> = { ...(quiz.headline || {}) };
    const updatedHeadlineHighlight: Record<string, string> = { ...(quiz.headline_highlight || {}) };

    // Always persist source values too
    updatedTitle[sourceLanguage] = sourceTitle;
    updatedDescription[sourceLanguage] = sourceDescription;
    updatedHeadline[sourceLanguage] = sourceHeadline;
    updatedHeadlineHighlight[sourceLanguage] = sourceHeadlineHighlight;

    let translatedCount = 0;
    for (const [langCode, t] of Object.entries(translations)) {
      if (t.title) updatedTitle[langCode] = t.title;
      if (t.description) updatedDescription[langCode] = t.description;
      if (t.headline) updatedHeadline[langCode] = t.headline;
      if (t.headline_highlight) updatedHeadlineHighlight[langCode] = t.headline_highlight;
      translatedCount++;
    }

    const { error: updateError } = await supabase
      .from("quizzes")
      .update({
        title: updatedTitle,
        description: updatedDescription,
        headline: updatedHeadline,
        headline_highlight: updatedHeadlineHighlight,
      })
      .eq("id", quizId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error("Failed to save translations");
    }

    console.log(`Quiz basics translation complete. Cost: €${costEur.toFixed(4)}`);

    return new Response(
      JSON.stringify({
        success: true,
        translatedCount,
        totalLanguages: targetLanguages.length,
        inputTokens: inputTokenEstimate,
        outputTokens: outputTokenEstimate,
        costEur,
        updatedTitle,
        updatedDescription,
        updatedHeadline,
        updatedHeadlineHighlight,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Quiz basics translation error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
