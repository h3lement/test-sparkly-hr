import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  sourceLanguage: string;
  sourceBody: string;
  targetLanguages: string[];
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

    const { sourceLanguage, sourceBody, targetLanguages }: TranslateRequest = await req.json();
    console.log(`Starting body translation from ${sourceLanguage} to ${targetLanguages.length} languages`);

    if (!sourceBody?.trim()) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No body content to translate",
        translations: {},
        inputTokens: 0,
        outputTokens: 0,
        cost: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!targetLanguages.length) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No target languages specified",
        translations: {},
        inputTokens: 0,
        outputTokens: 0,
        cost: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceLanguageName = ALL_TARGET_LANGUAGES.find(l => l.code === sourceLanguage)?.name || sourceLanguage;
    const translations: Record<string, string> = {};
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Translate to each target language one by one to preserve quality
    for (const targetLang of targetLanguages) {
      const targetLangName = ALL_TARGET_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;
      
      const prompt = `You are a professional HTML email translator. Translate the following HTML email template from ${sourceLanguageName} to ${targetLangName}.

CRITICAL RULES:
1. Keep ALL HTML tags and structure EXACTLY the same
2. Keep ALL placeholders EXACTLY as they are (e.g., {{score}}, {{resultTitle}}, {{insightsList}}, etc.) - DO NOT translate placeholders
3. Only translate the visible text content between HTML tags
4. Preserve all inline styles and attributes
5. Maintain professional business email tone
6. Return ONLY the translated HTML without any explanation or markdown formatting

HTML to translate:
${sourceBody}`;

      const inputTokenEstimate = Math.ceil(prompt.length / 4);
      totalInputTokens += inputTokenEstimate;

      console.log(`Translating to ${targetLangName}...`);

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
              content: "You are a precise HTML translator. Return ONLY the translated HTML without any markdown formatting, code blocks, or explanations. Preserve all placeholders like {{variable}} exactly as they are." 
            },
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Translation API error for ${targetLang}:`, errorText);
        continue; // Skip this language but continue with others
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || "";
      
      const outputTokenEstimate = Math.ceil(content.length / 4);
      totalOutputTokens += outputTokenEstimate;
      
      // Clean up markdown code blocks if present
      content = content
        .replace(/^```html\n?/i, "")
        .replace(/^```\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();
      
      if (content) {
        translations[targetLang] = content;
        console.log(`Successfully translated to ${targetLangName}`);
      }
    }

    // Calculate cost
    const cost = (totalInputTokens / 1000 * COST_PER_1K_INPUT_TOKENS) + 
                 (totalOutputTokens / 1000 * COST_PER_1K_OUTPUT_TOKENS);
    
    // Convert to EUR
    const costEur = cost * 0.92;
    
    console.log(`Body translation complete. Translated ${Object.keys(translations).length} languages. Cost: €${costEur.toFixed(6)}`);

    return new Response(JSON.stringify({ 
      success: true, 
      translatedLanguages: Object.keys(translations),
      translations,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cost: costEur,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Body translation error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
