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

// Get target languages (exclude source language)
function getTargetLanguages(sourceLanguage: string) {
  return ALL_TARGET_LANGUAGES.filter(l => l.code !== sourceLanguage);
}

interface TranslateRequest {
  templateId: string;
  sourceLanguage: string;
  sourceSubject: string;
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

    const { templateId, sourceLanguage, sourceSubject }: TranslateRequest = await req.json();
    console.log(`Starting translation for email template ${templateId} from ${sourceLanguage}`);

    if (!sourceSubject?.trim()) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No subject to translate",
        subjects: { [sourceLanguage]: sourceSubject },
        inputTokens: 0,
        outputTokens: 0,
        cost: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetLanguages = getTargetLanguages(sourceLanguage);
    const sourceLanguageName = ALL_TARGET_LANGUAGES.find(l => l.code === sourceLanguage)?.name || sourceLanguage;
    
    // Build translation prompt
    const prompt = `You are a professional translator. Translate the following email subject line from ${sourceLanguageName} to multiple languages.

Original subject (${sourceLanguageName}): "${sourceSubject}"

Translate to these languages and return ONLY a JSON object with language codes as keys and translations as values:
${targetLanguages.map(l => `- ${l.code}: ${l.name}`).join('\n')}

Keep the translation professional and suitable for a business email. Maintain any placeholders or special formatting.
Return only valid JSON without any markdown formatting.`;

    // Estimate input tokens (rough: 4 chars per token)
    const inputTokenEstimate = Math.ceil(prompt.length / 4);

    console.log(`Translating subject to ${targetLanguages.length} languages...`);

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
    
    // Estimate output tokens
    const outputTokenEstimate = Math.ceil(content.length / 4);
    
    // Clean up markdown code blocks if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let translations: Record<string, string> = {};
    try {
      translations = JSON.parse(content);
      console.log(`Got ${Object.keys(translations).length} translations`);
    } catch (parseError) {
      console.error("Failed to parse translations:", parseError);
      throw new Error("Failed to parse AI response");
    }

    // Add source language subject
    translations[sourceLanguage] = sourceSubject;

    // Calculate cost
    const cost = (inputTokenEstimate / 1000 * COST_PER_1K_INPUT_TOKENS) + 
                 (outputTokenEstimate / 1000 * COST_PER_1K_OUTPUT_TOKENS);
    
    // Convert to EUR (approximate conversion rate)
    const costEur = cost * 0.92;
    
    console.log(`Translation cost: €${costEur.toFixed(6)}`);

    // Update the template with translations and cost
    const { error: updateError } = await supabase
      .from("email_templates")
      .update({
        subjects: translations,
        input_tokens: inputTokenEstimate,
        output_tokens: outputTokenEstimate,
        estimated_cost_eur: costEur,
      })
      .eq("id", templateId);

    if (updateError) {
      console.error("Error updating template:", updateError);
      throw new Error("Failed to update template with translations");
    }

    console.log("Email template translation complete!");

    return new Response(JSON.stringify({ 
      success: true, 
      translatedLanguages: Object.keys(translations),
      subjects: translations,
      inputTokens: inputTokenEstimate,
      outputTokens: outputTokenEstimate,
      cost: costEur,
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
