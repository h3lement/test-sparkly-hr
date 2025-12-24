import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_LANGUAGES = ["ru", "uk"];

type QuizRow = {
  id: string;
  slug: string;
  primary_language: string | null;
};

type EmailTemplateRow = {
  id: string;
  template_type: string;
  subjects: unknown;
  body_content: unknown;
};

type WebResultVersionRow = {
  id: string;
  quiz_id: string;
  result_levels: unknown;
};

function asRecord(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  return {};
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { targetLanguages } = await req.json();
    const languages: string[] =
      Array.isArray(targetLanguages) && targetLanguages.length > 0
        ? targetLanguages
        : DEFAULT_LANGUAGES;

    console.log(`Starting batch translation for languages: ${languages.join(", ")}`);

    // 1) Translate all active quizzes (includes UI texts when includeUiText=true)
    const { data: quizzes, error: quizzesError } = await supabase
      .from("quizzes")
      .select("id, slug, primary_language")
      .eq("is_active", true);

    if (quizzesError) {
      throw new Error(`Failed to fetch quizzes: ${quizzesError.message}`);
    }

    const results: { scope: string; id: string; slug?: string; status: string; error?: string }[] = [];

    for (const quiz of (quizzes || []) as QuizRow[]) {
      console.log(`Processing quiz: ${quiz.slug} (${quiz.id})`);

      try {
        const { error } = await supabase.functions.invoke("translate-quiz", {
          body: {
            quizId: quiz.id,
            sourceLanguage: quiz.primary_language || "en",
            targetLanguages: languages,
            includeUiText: true,
            model: "google/gemini-2.5-flash",
          },
        });

        if (error) {
          console.error(`Quiz translation failed for ${quiz.slug}:`, error);
          results.push({ scope: "quiz", id: quiz.id, slug: quiz.slug, status: "error", error: error.message });
        } else {
          results.push({ scope: "quiz", id: quiz.id, slug: quiz.slug, status: "success" });
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error translating quiz ${quiz.slug}:`, err);
        results.push({ scope: "quiz", id: quiz.id, slug: quiz.slug, status: "error", error: errorMessage });
      }

      // Avoid rate limiting
      await sleep(1500);
    }

    // 2) Translate CTA templates (cta_templates table)
    const { data: ctaTemplates, error: ctaError } = await supabase
      .from("cta_templates")
      .select("id, name");

    if (ctaError) {
      console.warn("Failed to fetch CTA templates", ctaError);
    }

    for (const cta of ctaTemplates || []) {
      console.log(`Processing CTA template: ${cta.name} (${cta.id})`);

      try {
        const { error } = await supabase.functions.invoke("translate-cta", {
          body: {
            ctaTemplateId: cta.id,
            sourceLanguage: "en",
            targetLanguages: languages,
            regenerate: false,
          },
        });

        if (error) {
          console.error(`CTA template translation failed for ${cta.name}:`, error);
          results.push({ scope: "cta_template", id: cta.id, status: "error", error: error.message });
        } else {
          results.push({ scope: "cta_template", id: cta.id, status: "success" });
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error translating CTA template ${cta.name}:`, err);
        results.push({ scope: "cta_template", id: cta.id, status: "error", error: errorMessage });
      }

      await sleep(1000);
    }

    // 3) Translate email templates (subjects + body_content)
    const { data: emailTemplates, error: emailTemplatesError } = await supabase
      .from("email_templates")
      .select("id, template_type, subjects, body_content");

    if (emailTemplatesError) {
      console.warn("Failed to fetch email templates", emailTemplatesError);
    }

    for (const email of (emailTemplates || []) as EmailTemplateRow[]) {
      console.log(`Processing email template: ${email.template_type} (${email.id})`);

      // Subjects
      try {
        const subjects = asRecord(email.subjects) as Record<string, string>;
        const sourceSubject = (subjects["en"] || "").trim();

        if (sourceSubject) {
          const { error } = await supabase.functions.invoke("translate-email-template", {
            body: {
              templateId: email.id,
              sourceLanguage: "en",
              sourceSubject,
              targetLanguages: languages,
              forceRetranslate: false,
              stream: false,
            },
          });

          if (error) {
            console.error(`Email subject translation failed for ${email.id}:`, error);
            results.push({ scope: "email_subject", id: email.id, status: "error", error: error.message });
          } else {
            results.push({ scope: "email_subject", id: email.id, status: "success" });
          }
        } else {
          console.warn(`Skipping email subject translation for ${email.id}: no EN subject`);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error translating email subject ${email.id}:`, err);
        results.push({ scope: "email_subject", id: email.id, status: "error", error: errorMessage });
      }

      await sleep(700);

      // Body content
      try {
        const body = asRecord(email.body_content) as Record<string, string>;
        const sourceBody = (body["en"] || "").trim();

        if (sourceBody) {
          const { data, error } = await supabase.functions.invoke("translate-email-body", {
            body: {
              sourceLanguage: "en",
              sourceBody,
              targetLanguages: languages,
            },
          });

          if (error) {
            console.error(`Email body translation failed for ${email.id}:`, error);
            results.push({ scope: "email_body", id: email.id, status: "error", error: error.message });
          } else {
            const translations = asRecord(data?.translations) as Record<string, string>;
            if (Object.keys(translations).length > 0) {
              const mergedBody = { ...body, ...translations, en: sourceBody };
              const { error: updateErr } = await supabase
                .from("email_templates")
                .update({ body_content: mergedBody })
                .eq("id", email.id);

              if (updateErr) {
                console.error(`Failed to persist email body translations for ${email.id}:`, updateErr);
                results.push({ scope: "email_body", id: email.id, status: "error", error: updateErr.message });
              } else {
                results.push({ scope: "email_body", id: email.id, status: "success" });
              }
            } else {
              console.warn(`Email body translation returned empty for ${email.id}`);
            }
          }
        } else {
          console.warn(`Skipping email body translation for ${email.id}: no EN body`);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error translating email body ${email.id}:`, err);
        results.push({ scope: "email_body", id: email.id, status: "error", error: errorMessage });
      }

      await sleep(1000);
    }

    // 4) Translate web result versions
    const { data: webVersions, error: webError } = await supabase
      .from("quiz_result_versions")
      .select("id, quiz_id, result_levels");

    if (webError) {
      console.warn("Failed to fetch web result versions", webError);
    }

    for (const version of (webVersions || []) as WebResultVersionRow[]) {
      console.log(`Processing web result version: ${version.id}`);

      try {
        const { error } = await supabase.functions.invoke("translate-web-results", {
          body: {
            versionId: version.id,
            quizId: version.quiz_id,
            resultLevels: version.result_levels,
            sourceLanguage: "en",
            targetLanguages: languages,
            stream: false,
          },
        });

        if (error) {
          console.error(`Web results translation failed for ${version.id}:`, error);
          results.push({ scope: "web_results", id: version.id, status: "error", error: error.message });
        } else {
          results.push({ scope: "web_results", id: version.id, status: "success" });
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error translating web results ${version.id}:`, err);
        results.push({ scope: "web_results", id: version.id, status: "error", error: errorMessage });
      }

      await sleep(1000);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Batch translation completed for ${languages.join(", ")}`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Batch translation error:", error);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
