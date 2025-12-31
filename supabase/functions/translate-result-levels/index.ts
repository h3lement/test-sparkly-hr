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

type AnyRecord = Record<string, any>;

type ResultLevelRow = {
  id: string;
  quiz_id: string;
  min_score: number;
  max_score: number;
  title: Record<string, string> | null;
  description: Record<string, string> | null;
  insights: unknown;
  emoji: string | null;
  color_class: string | null;
};

function isPlainObject(value: unknown): value is AnyRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pickSourceText(
  obj: Record<string, string> | undefined | null,
  sourceLanguage: string,
  primaryLanguage: string,
): string | null {
  if (!obj) return null;
  return obj[sourceLanguage] || obj[primaryLanguage] || obj.en || null;
}

function safeParseJson<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/**
 * Normalizes `quiz_result_levels.insights` into the shape the frontend expects:
 * Array<Record<lang, string>>
 *
 * Handles legacy / inconsistent shapes:
 * - Array<string>
 * - Array<Record<lang, string>>
 * - Record<lang, string[]> (language arrays)
 * - Record<number-string, string> (e.g. {"0":"...","1":"..."})
 */
function normalizeInsights(
  rawInsights: unknown,
  sourceLanguage: string,
  primaryLanguage: string,
): Array<Record<string, string>> {
  if (!rawInsights) return [];

  // Shape: Array<...>
  if (Array.isArray(rawInsights)) {
    return rawInsights
      .map((item) => {
        if (typeof item === "string") {
          const lang = sourceLanguage || primaryLanguage || "en";
          return { [lang]: item };
        }
        if (isPlainObject(item)) {
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(item)) {
            if (typeof v === "string" && v.trim().length > 0) out[k] = v;
          }
          return out;
        }
        return {} as Record<string, string>;
      })
      .filter((x) => Object.keys(x).length > 0);
  }

  // Shape: Record<...>
  if (isPlainObject(rawInsights)) {
    const keys = Object.keys(rawInsights);

    // Shape: Record<lang, string[]> (language arrays)
    const looksLikeLanguageArrays = keys.some((k) => Array.isArray(rawInsights[k]));
    if (looksLikeLanguageArrays) {
      const langs = keys.filter((k) => Array.isArray(rawInsights[k]));
      const maxLen = Math.max(0, ...langs.map((l) => (rawInsights[l] as unknown[]).length));
      const out: Array<Record<string, string>> = Array.from({ length: maxLen }, () => ({}));
      for (const lang of langs) {
        const arr = rawInsights[lang] as unknown[];
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i];
          if (typeof v === "string" && v.trim().length > 0) {
            out[i][lang] = v;
          }
        }
      }
      return out.filter((x) => Object.keys(x).length > 0);
    }

    // Shape: Record<number-string, string>
    const numericKeys = keys.filter((k) => /^\d+$/.test(k));
    if (numericKeys.length > 0 && numericKeys.length === keys.length) {
      const lang = sourceLanguage || primaryLanguage || "en";
      return numericKeys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => {
          const v = rawInsights[k];
          if (typeof v === "string" && v.trim().length > 0) return { [lang]: v };
          return {} as Record<string, string>;
        })
        .filter((x) => Object.keys(x).length > 0);
    }
  }

  return [];
}

function hasInsightCoverage(insights: Array<Record<string, string>>, lang: string): boolean {
  if (insights.length === 0) return true;
  return insights.every((i) => typeof i?.[lang] === "string" && i[lang].trim().length > 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      quizId,
      sourceLanguage = "et",
      targetLanguageCodes,
    }: { quizId: string; sourceLanguage?: string; targetLanguageCodes?: string[] } = await req.json();

    const targetLanguageSet = Array.isArray(targetLanguageCodes) && targetLanguageCodes.length > 0
      ? new Set(targetLanguageCodes)
      : null;

    // Fetch quiz primary language (for better source selection)
    const { data: quizRow, error: quizErr } = await supabase
      .from("quizzes")
      .select("id, primary_language")
      .eq("id", quizId)
      .maybeSingle();

    if (quizErr) throw new Error(`Failed to fetch quiz: ${quizErr.message}`);

    const primaryLanguage = quizRow?.primary_language || "en";

    const { data: levels, error: fetchError } = await supabase
      .from("quiz_result_levels")
      .select("*")
      .eq("quiz_id", quizId)
      .order("min_score");

    if (fetchError) throw new Error(`Failed to fetch result levels: ${fetchError.message}`);

    if (!levels || levels.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No result levels found for this quiz" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetLanguages = ALL_TARGET_LANGUAGES
      .filter((l) => l.code !== sourceLanguage)
      .filter((l) => (targetLanguageSet ? targetLanguageSet.has(l.code) : true));

    // Prepare mutable updates per level and normalize insights once
    const perLevel = (levels as ResultLevelRow[]).map((level) => {
      const normalizedInsights = normalizeInsights(level.insights, sourceLanguage, primaryLanguage);
      return {
        level,
        updatedTitle: { ...(level.title || {}) } as Record<string, string>,
        updatedDescription: { ...(level.description || {}) } as Record<string, string>,
        updatedInsights: normalizedInsights.map((i) => ({ ...i })) as Array<Record<string, string>>,
        normalizedShapeDiffers: JSON.stringify(level.insights ?? null) !== JSON.stringify(normalizedInsights),
        changed: false,
      };
    });

    const results = {
      levelsUpdated: 0,
      failed: 0,
      skipped: 0,
      languagesProcessed: 0,
      details: [] as string[],
    };

    const sourceLangName = ALL_TARGET_LANGUAGES.find((l) => l.code === sourceLanguage)?.name || "Source";

    // Translate per-language (one AI call per target language)
    for (const lang of targetLanguages) {
      const items: Array<{ key: string; text: string }> = [];

      for (const entry of perLevel) {
        const { level, updatedTitle, updatedDescription, updatedInsights } = entry;

        const srcTitle = pickSourceText(level.title, sourceLanguage, primaryLanguage);
        const srcDesc = pickSourceText(level.description, sourceLanguage, primaryLanguage);

        if (srcTitle && !updatedTitle[lang.code]) {
          items.push({ key: `${level.id}.title`, text: srcTitle });
        }

        if (srcDesc && !updatedDescription[lang.code]) {
          items.push({ key: `${level.id}.description`, text: srcDesc });
        }

        const needsInsights = !hasInsightCoverage(updatedInsights, lang.code);
        if (needsInsights) {
          updatedInsights.forEach((insObj, idx) => {
            const already = insObj?.[lang.code];
            if (typeof already === "string" && already.trim().length > 0) return;

            const src = pickSourceText(insObj, sourceLanguage, primaryLanguage);
            if (src) items.push({ key: `${level.id}.insight.${idx}`, text: src });
          });
        }
      }

      if (items.length === 0) continue;

      const prompt = `You are a professional translator. Translate the following texts from ${sourceLangName} to ${lang.name}.\n\nReturn ONLY valid JSON mapping each key to its translated string.\nKeep the translations natural and appropriate for a professional quiz/assessment results context.\n\nItems:\n${JSON.stringify(items, null, 2)}`;

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
              { role: "system", content: "You are a precise translator. Return only JSON without markdown." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Translation API error (${lang.code}):`, errorText);
          results.failed++;
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        const parsed = safeParseJson<Record<string, string>>(content);

        if (!parsed) {
          console.error(`Failed to parse translation JSON for ${lang.code}`);
          results.failed++;
          continue;
        }

        // Apply translations back into per-level structures
        for (const entry of perLevel) {
          const { level, updatedTitle, updatedDescription, updatedInsights } = entry;

          const tTitle = parsed[`${level.id}.title`];
          if (typeof tTitle === "string" && tTitle.trim().length > 0 && !updatedTitle[lang.code]) {
            updatedTitle[lang.code] = tTitle;
            entry.changed = true;
          }

          const tDesc = parsed[`${level.id}.description`];
          if (typeof tDesc === "string" && tDesc.trim().length > 0 && !updatedDescription[lang.code]) {
            updatedDescription[lang.code] = tDesc;
            entry.changed = true;
          }

          for (let i = 0; i < updatedInsights.length; i++) {
            const tIns = parsed[`${level.id}.insight.${i}`];
            if (typeof tIns === "string" && tIns.trim().length > 0) {
              if (!updatedInsights[i]) updatedInsights[i] = {};
              if (!updatedInsights[i][lang.code] || updatedInsights[i][lang.code].trim().length === 0) {
                updatedInsights[i][lang.code] = tIns;
                entry.changed = true;
              }
            }
          }
        }

        results.languagesProcessed++;
      } catch (e) {
        console.error(`Translation error for ${lang.code}:`, e);
        results.failed++;
      }

      // gentle pacing
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Persist changes
    for (const entry of perLevel) {
      const { level, updatedTitle, updatedDescription, updatedInsights, changed, normalizedShapeDiffers } = entry;

      if (!changed && !normalizedShapeDiffers) {
        results.skipped++;
        continue;
      }

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
        results.details.push(`Level ${level.id}: update failed (${updateError.message})`);
      } else {
        results.levelsUpdated++;
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
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
