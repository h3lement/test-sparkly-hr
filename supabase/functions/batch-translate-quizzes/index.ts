import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { targetLanguages } = await req.json();
    const languages = targetLanguages || ["ru", "uk"];
    
    console.log(`Starting batch translation for languages: ${languages.join(", ")}`);

    // Fetch all active quizzes
    const { data: quizzes, error: quizzesError } = await supabase
      .from("quizzes")
      .select("id, slug, primary_language, title")
      .eq("is_active", true);

    if (quizzesError) {
      throw new Error(`Failed to fetch quizzes: ${quizzesError.message}`);
    }

    const results: { quizId: string; slug: string; status: string; error?: string }[] = [];

    for (const quiz of quizzes || []) {
      console.log(`Processing quiz: ${quiz.slug} (${quiz.id})`);
      
      try {
        // Call translate-quiz function for each quiz
        const response = await fetch(`${supabaseUrl}/functions/v1/translate-quiz`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            quizId: quiz.id,
            sourceLanguage: quiz.primary_language || "en",
            targetLanguages: languages,
            includeUiText: true,
            model: "google/gemini-2.5-flash",
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Translation failed for ${quiz.slug}: ${errorText}`);
          results.push({ quizId: quiz.id, slug: quiz.slug, status: "error", error: errorText });
        } else {
          const result = await response.json();
          console.log(`Translation completed for ${quiz.slug}:`, result);
          results.push({ quizId: quiz.id, slug: quiz.slug, status: "success" });
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error translating ${quiz.slug}:`, err);
        results.push({ quizId: quiz.id, slug: quiz.slug, status: "error", error: errorMessage });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Also translate CTA templates
    const { data: ctaTemplates } = await supabase
      .from("cta_templates")
      .select("id, quiz_id, name");

    for (const cta of ctaTemplates || []) {
      console.log(`Processing CTA template: ${cta.name} (${cta.id})`);
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/translate-cta`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            ctaTemplateId: cta.id,
            sourceLanguage: "en",
            targetLanguages: languages,
            model: "google/gemini-2.5-flash",
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`CTA translation failed for ${cta.name}: ${errorText}`);
        } else {
          console.log(`CTA translation completed for ${cta.name}`);
        }
      } catch (err) {
        console.error(`Error translating CTA ${cta.name}:`, err);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Also translate email templates
    const { data: emailTemplates } = await supabase
      .from("email_templates")
      .select("id, quiz_id, template_type");

    for (const email of emailTemplates || []) {
      console.log(`Processing email template: ${email.template_type} (${email.id})`);
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/translate-email-template`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            emailTemplateId: email.id,
            sourceLanguage: "en",
            targetLanguages: languages,
            model: "google/gemini-2.5-flash",
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Email template translation failed: ${errorText}`);
        } else {
          console.log(`Email template translation completed`);
        }
      } catch (err) {
        console.error(`Error translating email template:`, err);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Also translate web result versions
    const { data: webVersions } = await supabase
      .from("quiz_result_versions")
      .select("id, quiz_id");

    for (const version of webVersions || []) {
      console.log(`Processing web result version: ${version.id}`);
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/translate-web-results`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            versionId: version.id,
            sourceLanguage: "en",
            targetLanguages: languages,
            model: "google/gemini-2.5-flash",
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Web results translation failed: ${errorText}`);
        } else {
          console.log(`Web results translation completed`);
        }
      } catch (err) {
        console.error(`Error translating web results:`, err);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Batch translation completed for ${languages.join(", ")}`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Batch translation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
