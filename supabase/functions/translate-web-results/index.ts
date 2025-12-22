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

interface ResultLevel {
  title: Record<string, string>;
  description: Record<string, string>;
  insights: Record<string, string[]>;
  min_score: number;
  max_score: number;
}

interface TranslateRequest {
  versionId: string;
  quizId: string;
  resultLevels: ResultLevel[];
  sourceLanguage: string;
  targetLanguages: string[];
  stream?: boolean;
}

function getTargetLanguages(sourceLanguage: string, selectedLanguages?: string[]) {
  const allTargets = ALL_TARGET_LANGUAGES.filter(l => l.code !== sourceLanguage);
  if (selectedLanguages && selectedLanguages.length > 0) {
    return allTargets.filter(l => selectedLanguages.includes(l.code));
  }
  return allTargets;
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
      versionId, 
      quizId, 
      resultLevels, 
      sourceLanguage, 
      targetLanguages: selectedTargetLanguages,
      stream = false 
    }: TranslateRequest = await req.json();

    console.log(`Translating web results for version ${versionId} from ${sourceLanguage}`);
    console.log(`Result levels: ${resultLevels.length}, Target languages: ${selectedTargetLanguages.length}`);

    const targetLanguages = getTargetLanguages(sourceLanguage, selectedTargetLanguages);

    if (targetLanguages.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No languages to translate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect all texts to translate from result levels
    const textsToTranslate: { path: string; text: string }[] = [];
    
    resultLevels.forEach((level, levelIndex) => {
      const title = level.title?.[sourceLanguage];
      const description = level.description?.[sourceLanguage];
      const insights = level.insights?.[sourceLanguage] || [];
      
      if (title) {
        textsToTranslate.push({ path: `level.${levelIndex}.title`, text: title });
      }
      if (description) {
        textsToTranslate.push({ path: `level.${levelIndex}.description`, text: description });
      }
      insights.forEach((insight, insightIndex) => {
        if (insight) {
          textsToTranslate.push({ path: `level.${levelIndex}.insights.${insightIndex}`, text: insight });
        }
      });
    });

    if (textsToTranslate.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No texts to translate in source language",
        cost: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${textsToTranslate.length} texts to translate`);

    // For streaming response
    if (stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let totalCost = 0;
          let completedLanguages = 0;

          const sendEvent = (data: any) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          // Updated result levels with translations
          const updatedLevels = JSON.parse(JSON.stringify(resultLevels));

          for (const lang of targetLanguages) {
            sendEvent({
              type: "progress",
              currentLanguage: lang.name,
              completedLanguages,
              totalLanguages: targetLanguages.length,
              cost: totalCost,
            });

            console.log(`Translating to ${lang.name}...`);

            const prompt = `You are a professional translator. Translate the following texts from ${sourceLanguage === "en" ? "English" : "Estonian"} to ${lang.name}.

Return ONLY a JSON object where keys are the original text paths and values are the translations.
Keep the translations natural and appropriate for a professional quiz/assessment results context.
Maintain any formatting, emojis, or special characters.

Texts to translate:
${JSON.stringify(textsToTranslate, null, 2)}`;

            // Estimate input tokens
            const inputTokenEstimate = Math.ceil(prompt.length / 4);

            try {
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
                console.error(`Translation API error for ${lang.code}:`, errorText);
                continue;
              }

              const data = await response.json();
              let content = data.choices?.[0]?.message?.content || "";
              
              // Estimate output tokens
              const outputTokenEstimate = Math.ceil(content.length / 4);
              totalCost += (inputTokenEstimate / 1000 * COST_PER_1K_INPUT_TOKENS) + 
                          (outputTokenEstimate / 1000 * COST_PER_1K_OUTPUT_TOKENS);
              
              // Clean up markdown code blocks if present
              content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
              
              try {
                const parsed = JSON.parse(content);
                
                // Apply translations to result levels
                for (const item of textsToTranslate) {
                  const translated = parsed[item.path];
                  if (!translated) continue;

                  const match = item.path.match(/level\.(\d+)\.(\w+)(?:\.(\d+))?/);
                  if (!match) continue;

                  const levelIndex = parseInt(match[1]);
                  const field = match[2];
                  const insightIndex = match[3] !== undefined ? parseInt(match[3]) : null;

                  if (field === "title") {
                    if (!updatedLevels[levelIndex].title) updatedLevels[levelIndex].title = {};
                    updatedLevels[levelIndex].title[lang.code] = translated;
                  } else if (field === "description") {
                    if (!updatedLevels[levelIndex].description) updatedLevels[levelIndex].description = {};
                    updatedLevels[levelIndex].description[lang.code] = translated;
                  } else if (field === "insights" && insightIndex !== null) {
                    if (!updatedLevels[levelIndex].insights) updatedLevels[levelIndex].insights = {};
                    if (!updatedLevels[levelIndex].insights[lang.code]) {
                      updatedLevels[levelIndex].insights[lang.code] = [];
                    }
                    updatedLevels[levelIndex].insights[lang.code][insightIndex] = translated;
                  }
                }

                console.log(`Translated ${Object.keys(parsed).length} texts to ${lang.name}`);
              } catch (parseError) {
                console.error(`Failed to parse translations for ${lang.code}:`, parseError);
              }
            } catch (apiError) {
              console.error(`API error for ${lang.code}:`, apiError);
            }

            completedLanguages++;
          }

          // Update the version in database
          console.log("Updating database with translations...");
          
          const { error: updateError } = await supabase
            .from("quiz_result_versions")
            .update({ 
              result_levels: updatedLevels,
              estimated_cost_eur: totalCost * 0.92, // Convert USD to EUR approximately
            })
            .eq("id", versionId);

          if (updateError) {
            console.error("Database update error:", updateError);
            sendEvent({ type: "error", message: "Failed to save translations" });
          } else {
            console.log("Translations saved successfully");
            sendEvent({
              type: "complete",
              completedLanguages: targetLanguages.length,
              cost: totalCost * 0.92,
            });
          }

          sendEvent("[DONE]");
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Non-streaming response
    let totalCost = 0;
    const updatedLevels = JSON.parse(JSON.stringify(resultLevels));

    for (const lang of targetLanguages) {
      console.log(`Translating to ${lang.name}...`);

      const prompt = `You are a professional translator. Translate the following texts from ${sourceLanguage === "en" ? "English" : "Estonian"} to ${lang.name}.

Return ONLY a JSON object where keys are the original text paths and values are the translations.
Keep the translations natural and appropriate for a professional quiz/assessment results context.

Texts to translate:
${JSON.stringify(textsToTranslate, null, 2)}`;

      const inputTokenEstimate = Math.ceil(prompt.length / 4);

      try {
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
          console.error(`Translation API error for ${lang.code}`);
          continue;
        }

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || "";
        
        const outputTokenEstimate = Math.ceil(content.length / 4);
        totalCost += (inputTokenEstimate / 1000 * COST_PER_1K_INPUT_TOKENS) + 
                    (outputTokenEstimate / 1000 * COST_PER_1K_OUTPUT_TOKENS);
        
        content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        
        try {
          const parsed = JSON.parse(content);
          
          for (const item of textsToTranslate) {
            const translated = parsed[item.path];
            if (!translated) continue;

            const match = item.path.match(/level\.(\d+)\.(\w+)(?:\.(\d+))?/);
            if (!match) continue;

            const levelIndex = parseInt(match[1]);
            const field = match[2];
            const insightIndex = match[3] !== undefined ? parseInt(match[3]) : null;

            if (field === "title") {
              if (!updatedLevels[levelIndex].title) updatedLevels[levelIndex].title = {};
              updatedLevels[levelIndex].title[lang.code] = translated;
            } else if (field === "description") {
              if (!updatedLevels[levelIndex].description) updatedLevels[levelIndex].description = {};
              updatedLevels[levelIndex].description[lang.code] = translated;
            } else if (field === "insights" && insightIndex !== null) {
              if (!updatedLevels[levelIndex].insights) updatedLevels[levelIndex].insights = {};
              if (!updatedLevels[levelIndex].insights[lang.code]) {
                updatedLevels[levelIndex].insights[lang.code] = [];
              }
              updatedLevels[levelIndex].insights[lang.code][insightIndex] = translated;
            }
          }
        } catch (parseError) {
          console.error(`Failed to parse translations for ${lang.code}`);
        }
      } catch (apiError) {
        console.error(`API error for ${lang.code}:`, apiError);
      }
    }

    // Update database
    const { error: updateError } = await supabase
      .from("quiz_result_versions")
      .update({ 
        result_levels: updatedLevels,
        estimated_cost_eur: totalCost * 0.92,
      })
      .eq("id", versionId);

    if (updateError) {
      throw new Error("Failed to save translations");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Translated to ${targetLanguages.length} languages`,
      cost: totalCost * 0.92,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in translate-web-results:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
