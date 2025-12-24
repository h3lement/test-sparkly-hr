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

function resolveTargetLanguages(sourceLanguage: string, selected?: string[]) {
  const allTargets = ALL_TARGET_LANGUAGES.filter((l) => l.code !== sourceLanguage);
  if (selected && selected.length > 0) {
    return allTargets.filter((l) => selected.includes(l.code));
  }
  return allTargets;
}

interface TranslateRequest {
  quizId?: string;
  ctaTemplateId?: string;
  sourceLanguage: string;
  targetLanguages?: string[];
  regenerate?: boolean; // If true, regenerate all translations
  sourceContent?: {
    cta_title: string;
    cta_description: string;
    cta_text: string;
    cta_retry_text: string;
  };
}

type CtaRow = {
  id: string;
  cta_title: Record<string, string> | null;
  cta_description: Record<string, string> | null;
  cta_text: Record<string, string> | null;
  cta_retry_text: Record<string, string> | null;
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

    const {
      quizId,
      ctaTemplateId,
      sourceLanguage,
      targetLanguages: selectedTargetLanguages,
      regenerate = false,
      sourceContent,
    }: TranslateRequest = await req.json();

    const isTemplate = Boolean(ctaTemplateId);
    const entityId = ctaTemplateId || quizId;

    if (!entityId) {
      throw new Error("Missing quizId or ctaTemplateId");
    }

    console.log(
      `Starting CTA translation for ${isTemplate ? "cta_templates" : "quizzes"} ${entityId} from ${sourceLanguage} (regenerate: ${regenerate})`,
    );

    // Fetch CTA data
    let row: CtaRow | null = null;

    if (isTemplate) {
      const { data, error } = await supabase
        .from("cta_templates")
        .select("id, cta_title, cta_description, cta_text, cta_retry_text")
        .eq("id", entityId)
        .maybeSingle();

      if (error) throw error;
      row = data as unknown as CtaRow | null;
    } else {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, cta_title, cta_description, cta_text, cta_retry_text")
        .eq("id", entityId)
        .maybeSingle();

      if (error) throw error;
      row = data as unknown as CtaRow | null;
    }

    if (!row) {
      throw new Error("CTA source record not found");
    }

    // Use provided sourceContent if available, otherwise fall back to database
    const sourceTitle = sourceContent?.cta_title ?? row.cta_title?.[sourceLanguage] ?? "";
    const sourceDescription = sourceContent?.cta_description ?? row.cta_description?.[sourceLanguage] ?? "";
    const sourceButtonText = sourceContent?.cta_text ?? row.cta_text?.[sourceLanguage] ?? "";
    const sourceRetryText = sourceContent?.cta_retry_text ?? row.cta_retry_text?.[sourceLanguage] ?? "";

    if (!sourceTitle.trim() && !sourceDescription.trim() && !sourceButtonText.trim() && !sourceRetryText.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `No CTA content found for source language ${sourceLanguage}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve target languages
    let targetLanguages = resolveTargetLanguages(sourceLanguage, selectedTargetLanguages);

    // If regenerate is false, translate missing languages only
    if (!regenerate) {
      targetLanguages = targetLanguages.filter((l) => {
        const hasTitle = row?.cta_title?.[l.code]?.trim();
        const hasDesc = row?.cta_description?.[l.code]?.trim();
        const hasButton = row?.cta_text?.[l.code]?.trim();
        const hasRetry = row?.cta_retry_text?.[l.code]?.trim();
        return !hasTitle || !hasDesc || !hasButton || !hasRetry;
      });

      if (targetLanguages.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "All selected languages already have translations",
            translatedCount: 0,
            costEur: 0,
            updatedCtaTitle: { ...(row.cta_title || {}), [sourceLanguage]: sourceTitle },
            updatedCtaDescription: { ...(row.cta_description || {}), [sourceLanguage]: sourceDescription },
            updatedCtaText: { ...(row.cta_text || {}), [sourceLanguage]: sourceButtonText },
            updatedCtaRetryText: { ...(row.cta_retry_text || {}), [sourceLanguage]: sourceRetryText },
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
      cta_title: sourceTitle,
      cta_description: sourceDescription,
      cta_text: sourceButtonText,
      cta_retry_text: sourceRetryText,
    };

    console.log(`Translating CTA to ${targetLanguages.length} languages...`);

    const prompt = `You are a professional translator. Translate the following CTA (Call-to-Action) content from ${sourceLangName} to these languages: ${targetLanguages
      .map((l) => `${l.code} (${l.name})`)
      .join(", ")}.

Return ONLY a valid JSON object with this structure:
{
  "lang_code": {
    "cta_title": "translated title",
    "cta_description": "translated description",
    "cta_text": "translated button text",
    "cta_retry_text": "translated retry button text"
  },
  ...
}

Source content to translate:
${JSON.stringify(contentToTranslate, null, 2)}

Important:
- Keep translations natural and professional
- Button text should be concise and action-oriented
- Retry button text should be short and encourage re-taking the quiz
- Maintain the same tone and meaning
- Use proper capitalization for each language`;

    const inputTokenEstimate = Math.ceil(prompt.length / 4);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
      { cta_title?: string; cta_description?: string; cta_text?: string; cta_retry_text?: string }
    >;

    try {
      translations = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse translations:", parseError);
      console.error("Content:", content);
      throw new Error("Failed to parse AI response");
    }

    const updatedCtaTitle: Record<string, string> = { ...(row.cta_title || {}) };
    const updatedCtaDescription: Record<string, string> = { ...(row.cta_description || {}) };
    const updatedCtaText: Record<string, string> = { ...(row.cta_text || {}) };
    const updatedCtaRetryText: Record<string, string> = { ...(row.cta_retry_text || {}) };

    // Always persist source values too
    updatedCtaTitle[sourceLanguage] = sourceTitle;
    updatedCtaDescription[sourceLanguage] = sourceDescription;
    updatedCtaText[sourceLanguage] = sourceButtonText;
    updatedCtaRetryText[sourceLanguage] = sourceRetryText;

    let translatedCount = 0;
    for (const [langCode, t] of Object.entries(translations)) {
      if (t.cta_title) updatedCtaTitle[langCode] = t.cta_title;
      if (t.cta_description) updatedCtaDescription[langCode] = t.cta_description;
      if (t.cta_text) updatedCtaText[langCode] = t.cta_text;
      if (t.cta_retry_text) updatedCtaRetryText[langCode] = t.cta_retry_text;
      translatedCount++;
    }

    const table = isTemplate ? "cta_templates" : "quizzes";

    const { error: updateError } = await supabase
      .from(table)
      .update({
        cta_title: updatedCtaTitle,
        cta_description: updatedCtaDescription,
        cta_text: updatedCtaText,
        cta_retry_text: updatedCtaRetryText,
      })
      .eq("id", entityId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error("Failed to save translations");
    }

    console.log(`CTA translation complete (${table}). Cost: €${costEur.toFixed(4)}`);

    return new Response(
      JSON.stringify({
        success: true,
        translatedCount,
        totalLanguages: targetLanguages.length,
        inputTokens: inputTokenEstimate,
        outputTokens: outputTokenEstimate,
        costEur,
        updatedCtaTitle,
        updatedCtaDescription,
        updatedCtaText,
        updatedCtaRetryText,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("CTA translation error:", error);
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
