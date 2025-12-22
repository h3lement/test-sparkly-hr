import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// All supported target languages
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

interface TranslateRequest {
  quizId: string;
  sourceLanguage: string;
  regenerate?: boolean; // If true, regenerate all translations
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

    const { quizId, sourceLanguage, regenerate = false }: TranslateRequest = await req.json();
    console.log(`Starting CTA translation for quiz ${quizId} from ${sourceLanguage} (regenerate: ${regenerate})`);

    // Fetch quiz CTA data
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, cta_title, cta_description, cta_text")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      throw new Error("Quiz not found");
    }

    // Get source content
    const sourceTitle = quiz.cta_title?.[sourceLanguage] || "";
    const sourceDescription = quiz.cta_description?.[sourceLanguage] || "";
    const sourceButtonText = quiz.cta_text?.[sourceLanguage] || "";

    if (!sourceTitle && !sourceDescription && !sourceButtonText) {
      return new Response(JSON.stringify({
        success: false,
        message: `No CTA content found for source language ${sourceLanguage}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get target languages (exclude source)
    // If regenerate is false, only translate missing languages
    let targetLanguages = ALL_TARGET_LANGUAGES.filter(l => l.code !== sourceLanguage);
    
    if (!regenerate) {
      // Filter to only languages that don't have translations yet
      targetLanguages = targetLanguages.filter(l => {
        const hasTitle = quiz.cta_title?.[l.code]?.trim();
        const hasDesc = quiz.cta_description?.[l.code]?.trim();
        const hasButton = quiz.cta_text?.[l.code]?.trim();
        return !hasTitle || !hasDesc || !hasButton;
      });
      
      if (targetLanguages.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: "All languages already have translations",
          translatedCount: 0,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build source content object
    const sourceContent = {
      cta_title: sourceTitle,
      cta_description: sourceDescription,
      cta_text: sourceButtonText,
    };

    console.log(`Translating CTA to ${targetLanguages.length} languages (regenerate: ${regenerate})...`);
    console.log("Source content:", sourceContent);

    // Translate to all languages in one request
    const prompt = `You are a professional translator. Translate the following CTA (Call-to-Action) content from ${
      sourceLanguage === "en" ? "English" : ALL_TARGET_LANGUAGES.find(l => l.code === sourceLanguage)?.name || sourceLanguage
    } to ALL of these languages: ${targetLanguages.map(l => l.name).join(", ")}.

Return ONLY a valid JSON object with this structure:
{
  "lang_code": {
    "cta_title": "translated title",
    "cta_description": "translated description",
    "cta_text": "translated button text"
  },
  ...
}

Source content to translate:
${JSON.stringify(sourceContent, null, 2)}

Important:
- Keep translations natural and professional
- Button text should be concise and action-oriented
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
          { role: "system", content: "You are a precise translator. Return only valid JSON without markdown formatting." },
          { role: "user", content: prompt }
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
    const costUsd = (inputTokenEstimate / 1000 * COST_PER_1K_INPUT_TOKENS) + 
                   (outputTokenEstimate / 1000 * COST_PER_1K_OUTPUT_TOKENS);
    const costEur = costUsd * 0.92;

    // Clean up markdown code blocks if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let translations: Record<string, { cta_title: string; cta_description: string; cta_text: string }>;
    try {
      translations = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse translations:", parseError);
      console.error("Content:", content);
      throw new Error("Failed to parse AI response");
    }

    // Build update object
    const updatedCtaTitle = { ...quiz.cta_title, [sourceLanguage]: sourceTitle };
    const updatedCtaDescription = { ...quiz.cta_description, [sourceLanguage]: sourceDescription };
    const updatedCtaText = { ...quiz.cta_text, [sourceLanguage]: sourceButtonText };

    let translatedCount = 0;
    for (const [langCode, translation] of Object.entries(translations)) {
      if (translation.cta_title) updatedCtaTitle[langCode] = translation.cta_title;
      if (translation.cta_description) updatedCtaDescription[langCode] = translation.cta_description;
      if (translation.cta_text) updatedCtaText[langCode] = translation.cta_text;
      translatedCount++;
    }

    console.log(`Translated to ${translatedCount} languages`);

    // Update quiz
    const { error: updateError } = await supabase
      .from("quizzes")
      .update({
        cta_title: updatedCtaTitle,
        cta_description: updatedCtaDescription,
        cta_text: updatedCtaText,
      })
      .eq("id", quizId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error("Failed to save translations");
    }

    console.log(`CTA translation complete. Cost: €${costEur.toFixed(4)}`);

    return new Response(JSON.stringify({
      success: true,
      translatedCount,
      totalLanguages: targetLanguages.length,
      inputTokens: inputTokenEstimate,
      outputTokens: outputTokenEstimate,
      costEur,
      updatedCtaTitle,
      updatedCtaDescription,
      updatedCtaText,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("CTA translation error:", error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
