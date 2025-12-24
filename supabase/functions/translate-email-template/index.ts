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

function getTargetLanguages(sourceLanguage: string, selectedLanguages?: string[]) {
  const allTargets = ALL_TARGET_LANGUAGES.filter((l) => l.code !== sourceLanguage);
  if (selectedLanguages && selectedLanguages.length > 0) {
    return allTargets.filter((l) => selectedLanguages.includes(l.code));
  }
  return allTargets;
}

interface TranslateRequest {
  templateId: string;
  sourceLanguage: string;
  sourceSubject: string;
  targetLanguages?: string[];
  stream?: boolean;
  forceRetranslate?: boolean; // If true, regenerate all translations
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
      templateId,
      sourceLanguage,
      sourceSubject,
      targetLanguages: selectedTargetLanguages,
      stream = false,
      forceRetranslate = false,
    }: TranslateRequest = await req.json();

    console.log(
      `Starting translation for email template ${templateId} from ${sourceLanguage}, stream: ${stream}, forceRetranslate: ${forceRetranslate}`,
    );

    if (!sourceSubject?.trim()) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No subject to translate",
          subjects: { [sourceLanguage]: sourceSubject },
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Load existing subjects (for missing-only behavior)
    let existingSubjects: Record<string, string> = {};
    let shouldPersist = templateId !== "preview";

    if (shouldPersist) {
      const { data: tpl, error: tplErr } = await supabase
        .from("email_templates")
        .select("subjects")
        .eq("id", templateId)
        .maybeSingle();

      if (tplErr) {
        console.warn("Failed to fetch existing email template subjects; continuing", tplErr);
      } else if (tpl?.subjects && typeof tpl.subjects === "object") {
        existingSubjects = tpl.subjects as Record<string, string>;
      } else if (!tpl) {
        // Template not found; treat as preview (no persistence)
        shouldPersist = false;
      }
    }

    const sourceLanguageName =
      ALL_TARGET_LANGUAGES.find((l) => l.code === sourceLanguage)?.name || sourceLanguage;

    let targetLanguages = getTargetLanguages(sourceLanguage, selectedTargetLanguages);

    if (!forceRetranslate) {
      targetLanguages = targetLanguages.filter((l) => !existingSubjects?.[l.code]?.trim());
    }

    if (targetLanguages.length === 0) {
      const merged = { ...existingSubjects, [sourceLanguage]: sourceSubject };
      return new Response(
        JSON.stringify({
          success: true,
          message: "No missing subject translations",
          subjects: merged,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const prompt = `Translate the following email subject line from ${sourceLanguageName} to the specified languages.

Original subject (${sourceLanguageName}): "${sourceSubject}"

Target languages: ${targetLanguages.map((l) => `${l.code} (${l.name})`).join(", ")}

Keep the translation professional and suitable for a business email. Maintain any placeholders or special formatting.`;

    // Build properties for tool calling - each language gets a property
    const translationProperties: Record<string, { type: string; description: string }> = {};
    for (const lang of targetLanguages) {
      translationProperties[lang.code] = {
        type: "string",
        description: `Translation in ${lang.name}`,
      };
    }

    const inputTokenEstimate = Math.ceil(prompt.length / 4);

    const runTranslation = async () => {
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
              content: "You are a professional translator. Translate precisely and maintain formatting.",
            },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "save_translations",
                description: "Save the translated email subjects for all languages",
                parameters: {
                  type: "object",
                  properties: translationProperties,
                  required: targetLanguages.map((l) => l.code),
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "save_translations" } },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Translation API error:", errorText);
        throw new Error(`Translation API error: ${response.status}`);
      }

      const data = await response.json();

      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        console.error("No tool call in response:", JSON.stringify(data));
        throw new Error("AI did not return translations in expected format");
      }

      let translations: Record<string, string> = {};
      try {
        translations = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        console.error("Failed to parse tool call arguments:", parseError);
        throw new Error("Failed to parse AI response");
      }

      return translations;
    };

    // Streaming wrapper (kept for existing UI expectations)
    if (stream) {
      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, data: any) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          try {
            sendEvent("progress", {
              stage: "starting",
              message: "Starting translation...",
              inputTokens: inputTokenEstimate,
              outputTokens: 0,
              cost: 0,
              languages: targetLanguages.length,
            });

            sendEvent("progress", {
              stage: "translating",
              message: "AI is translating...",
              inputTokens: inputTokenEstimate,
              outputTokens: 0,
              cost: (inputTokenEstimate / 1000 * COST_PER_1K_INPUT_TOKENS) * 0.92,
              languages: targetLanguages.length,
            });

            const newTranslations = await runTranslation();
            const outputTokens = Math.ceil(JSON.stringify(newTranslations).length / 4);

            const finalCostEur =
              ((inputTokenEstimate / 1000) * COST_PER_1K_INPUT_TOKENS +
                (outputTokens / 1000) * COST_PER_1K_OUTPUT_TOKENS) *
              0.92;

            const mergedSubjects = {
              ...existingSubjects,
              ...newTranslations,
              [sourceLanguage]: sourceSubject,
            };

            sendEvent("progress", {
              stage: "saving",
              message: shouldPersist ? "Saving translations..." : "Preparing preview translations...",
              inputTokens: inputTokenEstimate,
              outputTokens,
              cost: finalCostEur,
              translatedCount: Object.keys(newTranslations).length,
              totalLanguages: targetLanguages.length,
            });

            if (shouldPersist) {
              const { error: updateError } = await supabase
                .from("email_templates")
                .update({
                  subjects: mergedSubjects,
                  input_tokens: inputTokenEstimate,
                  output_tokens: outputTokens,
                  estimated_cost_eur: finalCostEur,
                })
                .eq("id", templateId);

              if (updateError) {
                console.error("Error updating template:", updateError);
                sendEvent("error", { message: "Failed to update template with translations" });
                controller.close();
                return;
              }
            }

            sendEvent("complete", {
              success: true,
              translatedLanguages: Object.keys(newTranslations),
              subjects: mergedSubjects,
              inputTokens: inputTokenEstimate,
              outputTokens,
              cost: finalCostEur,
            });

            controller.close();
          } catch (error) {
            console.error("Streaming error:", error);
            sendEvent("error", { message: error instanceof Error ? error.message : "Unknown error" });
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming
    const newTranslations = await runTranslation();
    const outputTokenEstimate = Math.ceil(JSON.stringify(newTranslations).length / 4);

    const costEur =
      ((inputTokenEstimate / 1000) * COST_PER_1K_INPUT_TOKENS +
        (outputTokenEstimate / 1000) * COST_PER_1K_OUTPUT_TOKENS) *
      0.92;

    const mergedSubjects = {
      ...existingSubjects,
      ...newTranslations,
      [sourceLanguage]: sourceSubject,
    };

    if (shouldPersist) {
      const { error: updateError } = await supabase
        .from("email_templates")
        .update({
          subjects: mergedSubjects,
          input_tokens: inputTokenEstimate,
          output_tokens: outputTokenEstimate,
          estimated_cost_eur: costEur,
        })
        .eq("id", templateId);

      if (updateError) {
        console.error("Error updating template:", updateError);
        throw new Error("Failed to update template with translations");
      }
    }

    console.log("Email template subject translation complete!");

    return new Response(
      JSON.stringify({
        success: true,
        translatedLanguages: Object.keys(newTranslations),
        subjects: mergedSubjects,
        inputTokens: inputTokenEstimate,
        outputTokens: outputTokenEstimate,
        cost: costEur,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Translation error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
