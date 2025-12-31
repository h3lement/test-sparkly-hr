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
  { code: "ru", name: "Russian" },
  { code: "uk", name: "Ukrainian" },
];

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

    const { quizId, sourceLanguage = "et" } = await req.json();

    console.log(`Translating result levels for quiz ${quizId} from ${sourceLanguage}`);

    // Fetch quiz_result_levels for this quiz
    const { data: levels, error: fetchError } = await supabase
      .from("quiz_result_levels")
      .select("*")
      .eq("quiz_id", quizId)
      .order("min_score");

    if (fetchError) {
      throw new Error(`Failed to fetch result levels: ${fetchError.message}`);
    }

    if (!levels || levels.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No result levels found for this quiz" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${levels.length} result levels to translate`);

    // Find languages that need translation
    const targetLanguages = ALL_TARGET_LANGUAGES.filter(l => l.code !== sourceLanguage);
    
    const results = {
      translated: 0,
      failed: 0,
      skipped: 0,
      details: [] as string[],
    };

    for (const level of levels) {
      const sourceTitle = level.title?.[sourceLanguage];
      const sourceDescription = level.description?.[sourceLanguage];
      const sourceInsights = level.insights?.[sourceLanguage] || [];

      if (!sourceTitle && !sourceDescription) {
        console.log(`Level ${level.id} has no source content in ${sourceLanguage}, skipping`);
        results.skipped++;
        continue;
      }

      // Collect texts to translate
      const textsToTranslate: { path: string; text: string }[] = [];
      
      if (sourceTitle) {
        textsToTranslate.push({ path: "title", text: sourceTitle });
      }
      if (sourceDescription) {
        textsToTranslate.push({ path: "description", text: sourceDescription });
      }
      sourceInsights.forEach((insight: string, index: number) => {
        if (insight) {
          textsToTranslate.push({ path: `insight.${index}`, text: insight });
        }
      });

      // Find missing languages for this level
      const existingTitleLangs = Object.keys(level.title || {});
      const existingDescLangs = Object.keys(level.description || {});
      const existingInsightLangs = Object.keys(level.insights || {});
      
      const missingLanguages = targetLanguages.filter(lang => 
        !existingTitleLangs.includes(lang.code) || 
        !existingDescLangs.includes(lang.code) ||
        (sourceInsights.length > 0 && !existingInsightLangs.includes(lang.code))
      );

      if (missingLanguages.length === 0) {
        console.log(`Level ${level.id} already has all translations`);
        results.skipped++;
        continue;
      }

      console.log(`Level ${level.id}: translating to ${missingLanguages.length} languages`);

      const updatedTitle = { ...(level.title || {}) };
      const updatedDescription = { ...(level.description || {}) };
      const updatedInsights = { ...(level.insights || {}) };

      for (const lang of missingLanguages) {
        // Skip if this language already has translations
        if (updatedTitle[lang.code] && updatedDescription[lang.code]) {
          continue;
        }

        const sourceLangName = ALL_TARGET_LANGUAGES.find(l => l.code === sourceLanguage)?.name || "Estonian";

        const prompt = `You are a professional translator. Translate the following texts from ${sourceLangName} to ${lang.name}.

Return ONLY a JSON object where keys are the text paths and values are the translations.
Keep the translations natural and appropriate for a professional quiz/assessment results context.
Maintain any formatting, emojis, or special characters.

Texts to translate:
${JSON.stringify(textsToTranslate, null, 2)}`;

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
            results.failed++;
            continue;
          }

          const data = await response.json();
          let content = data.choices?.[0]?.message?.content || "";
          
          // Clean up markdown code blocks if present
          content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          
          try {
            const parsed = JSON.parse(content);
            
            if (parsed.title) {
              updatedTitle[lang.code] = parsed.title;
            }
            if (parsed.description) {
              updatedDescription[lang.code] = parsed.description;
            }
            
            // Handle insights
            const insightKeys = Object.keys(parsed).filter(k => k.startsWith("insight."));
            if (insightKeys.length > 0) {
              if (!updatedInsights[lang.code]) {
                updatedInsights[lang.code] = [];
              }
              for (const key of insightKeys) {
                const index = parseInt(key.split(".")[1]);
                updatedInsights[lang.code][index] = parsed[key];
              }
            }

            console.log(`Translated level ${level.id} to ${lang.name}`);
          } catch (parseError) {
            console.error(`Failed to parse translations for ${lang.code}:`, parseError);
            results.failed++;
          }
        } catch (apiError) {
          console.error(`API error for ${lang.code}:`, apiError);
          results.failed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Update the level in database
      const { error: updateError } = await supabase
        .from("quiz_result_levels")
        .update({
          title: updatedTitle,
          description: updatedDescription,
          insights: updatedInsights,
        })
        .eq("id", level.id);

      if (updateError) {
        console.error(`Failed to update level ${level.id}:`, updateError);
        results.failed++;
        results.details.push(`Level ${level.id}: update failed`);
      } else {
        results.translated++;
        results.details.push(`Level ${level.id}: translated successfully`);
      }
    }

    console.log(`Translation complete. Translated: ${results.translated}, Failed: ${results.failed}, Skipped: ${results.skipped}`);

    return new Response(JSON.stringify({ 
      success: true, 
      ...results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in translate-result-levels:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
