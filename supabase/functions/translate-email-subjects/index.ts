import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function safeJsonParse<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function pickSourceSubject(
  subjects: Record<string, string> | null | undefined,
  sourceLanguage: string,
  primaryLanguage: string,
): string | null {
  if (!subjects) return null;
  return subjects[sourceLanguage] || subjects[primaryLanguage] || subjects.en || null;
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
      quizIds,
      templateTypes,
      sourceLanguage = "en",
      targetLanguageCodes,
    }: {
      quizIds?: string[];
      templateTypes?: string[];
      sourceLanguage?: string;
      targetLanguageCodes?: string[];
    } = await req.json().catch(() => ({}));

    const targetLanguageSet = Array.isArray(targetLanguageCodes) && targetLanguageCodes.length > 0
      ? new Set(targetLanguageCodes)
      : null;

    const targets = ALL_TARGET_LANGUAGES
      .filter((l) => l.code !== sourceLanguage)
      .filter((l) => (targetLanguageSet ? targetLanguageSet.has(l.code) : true));

    // Fetch quiz primary languages (for better source fallback)
    // We first fetch templates, then load primary_language for involved quiz_ids.
    const primaryByQuizId = new Map<string, string>();

    // Fetch email templates
    let query = supabase
      .from("email_templates")
      .select("id, quiz_id, template_type, subjects")
      .order("created_at", { ascending: true });

    if (Array.isArray(quizIds) && quizIds.length > 0) {
      query = query.in("quiz_id", quizIds);
    }

    if (Array.isArray(templateTypes) && templateTypes.length > 0) {
      query = query.in("template_type", templateTypes);
    }

    const { data: templates, error: tplErr } = await query;
    if (tplErr) throw new Error(`Failed to fetch email templates: ${tplErr.message}`);

    if (!templates || templates.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No email templates found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If we didn't prefetch quiz primary_language (because quizIds not provided), fetch now for involved quizzes
    if (!(Array.isArray(quizIds) && quizIds.length > 0)) {
      const ids = Array.from(new Set(templates.map((t: any) => t.quiz_id).filter(Boolean)));
      if (ids.length > 0) {
        const { data: qRows, error: qErr } = await supabase
          .from("quizzes")
          .select("id, primary_language")
          .in("id", ids);
        if (qErr) throw new Error(`Failed to fetch quizzes: ${qErr.message}`);
        (qRows || []).forEach((q: any) => primaryByQuizId.set(q.id, q.primary_language || "en"));
      }
    }

    const results = {
      templatesUpdated: 0,
      skipped: 0,
      failed: 0,
      details: [] as string[],
    };

    for (const tpl of templates as any[]) {
      const subjects = (tpl.subjects || {}) as Record<string, string>;
      const primaryLanguage = primaryByQuizId.get(tpl.quiz_id) || "en";

      const src = pickSourceSubject(subjects, sourceLanguage, primaryLanguage);
      if (!src || src.trim().length === 0) {
        results.skipped++;
        results.details.push(`Template ${tpl.id}: skipped (no source subject)`);
        continue;
      }

      const missing = targets
        .map((t) => t.code)
        .filter((code) => !(typeof subjects?.[code] === "string" && subjects[code].trim().length > 0));

      if (missing.length === 0) {
        results.skipped++;
        results.details.push(`Template ${tpl.id}: skipped (already complete)`);
        continue;
      }

      const langNames = missing
        .map((code) => ALL_TARGET_LANGUAGES.find((l) => l.code === code)!)
        .filter(Boolean)
        .map((l) => `${l.code}:${l.name}`)
        .join(", ");

      const sourceLangName = ALL_TARGET_LANGUAGES.find((l) => l.code === sourceLanguage)?.name || "Source";

      const prompt = `Translate this email subject from ${sourceLangName} to the following languages (${langNames}).\n\nSubject: ${JSON.stringify(src)}\n\nReturn ONLY valid JSON mapping language code to translated subject string.`;

      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

        if (!resp.ok) {
          const t = await resp.text();
          console.error("AI gateway error:", resp.status, t);
          if (resp.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (resp.status === 402) {
            return new Response(
              JSON.stringify({ error: "Payment required, please add funds to your AI workspace." }),
              {
                status: 402,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
          results.failed++;
          results.details.push(`Template ${tpl.id}: AI error (${resp.status})`);
          continue;
        }

        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || "";
        const parsed = safeJsonParse<Record<string, string>>(content);

        if (!parsed) {
          results.failed++;
          results.details.push(`Template ${tpl.id}: parse failed`);
          continue;
        }

        const updated: Record<string, string> = { ...subjects };
        for (const code of missing) {
          const v = parsed[code];
          if (typeof v === "string" && v.trim().length > 0) updated[code] = v;
        }

        const { error: upErr } = await supabase
          .from("email_templates")
          .update({ subjects: updated })
          .eq("id", tpl.id);

        if (upErr) {
          results.failed++;
          results.details.push(`Template ${tpl.id}: update failed (${upErr.message})`);
        } else {
          results.templatesUpdated++;
          results.details.push(`Template ${tpl.id}: updated (${missing.length} langs)`);
        }
      } catch (e) {
        console.error(`Template ${tpl.id} failed:`, e);
        results.failed++;
        results.details.push(`Template ${tpl.id}: exception`);
      }

      // gentle pacing
      await new Promise((r) => setTimeout(r, 200));
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("translate-email-subjects error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
