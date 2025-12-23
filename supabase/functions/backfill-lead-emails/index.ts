import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { leadType, limit = 50 } = await req.json();

    const results = { processed: 0, errors: 0, skipped: 0, details: [] as string[] };

    if (!leadType || leadType === "quiz") {
      // Get quiz leads without email_html
      const { data: quizLeads, error: quizError } = await supabase
        .from("quiz_leads")
        .select("id, email, score, total_questions, result_category, language, quiz_id, openness_score, answers")
        .is("email_html", null)
        .limit(limit);

      if (quizError) {
        console.error("Error fetching quiz leads:", quizError);
        results.details.push(`Quiz leads fetch error: ${quizError.message}`);
      } else if (quizLeads && quizLeads.length > 0) {
        console.log(`Found ${quizLeads.length} quiz leads without email_html`);

        for (const lead of quizLeads) {
          try {
            // Call render-email-preview to generate the HTML
            const { data: previewData, error: previewError } = await supabase.functions.invoke(
              "render-email-preview",
              {
                body: {
                  leadId: lead.id,
                  leadType: "quiz",
                  score: lead.score,
                  totalQuestions: lead.total_questions,
                  resultCategory: lead.result_category,
                  language: lead.language || "en",
                  quizId: lead.quiz_id,
                  openMindednessScore: lead.openness_score,
                  answers: lead.answers,
                },
              }
            );

            if (previewError) {
              console.error(`Error generating preview for quiz lead ${lead.id}:`, previewError);
              results.errors++;
              results.details.push(`Quiz ${lead.id}: preview error - ${previewError.message}`);
              continue;
            }

            const { html, subject } = previewData;

            if (!html) {
              console.log(`No HTML generated for quiz lead ${lead.id}`);
              results.skipped++;
              results.details.push(`Quiz ${lead.id}: no HTML generated`);
              continue;
            }

            // Update the lead with the generated HTML
            const { error: updateError } = await supabase
              .from("quiz_leads")
              .update({ email_html: html, email_subject: subject })
              .eq("id", lead.id);

            if (updateError) {
              console.error(`Error updating quiz lead ${lead.id}:`, updateError);
              results.errors++;
              results.details.push(`Quiz ${lead.id}: update error - ${updateError.message}`);
            } else {
              console.log(`Successfully backfilled quiz lead ${lead.id}`);
              results.processed++;
            }
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error(`Exception processing quiz lead ${lead.id}:`, err);
            results.errors++;
            results.details.push(`Quiz ${lead.id}: exception - ${errorMessage}`);
          }
        }
      } else {
        results.details.push("No quiz leads found without email_html");
      }
    }

    if (!leadType || leadType === "hypothesis") {
      // Get hypothesis leads without email_html
      const { data: hypothesisLeads, error: hypothesisError } = await supabase
        .from("hypothesis_leads")
        .select("id, email, score, total_questions, language, quiz_id, openness_score")
        .is("email_html", null)
        .limit(limit);

      if (hypothesisError) {
        console.error("Error fetching hypothesis leads:", hypothesisError);
        results.details.push(`Hypothesis leads fetch error: ${hypothesisError.message}`);
      } else if (hypothesisLeads && hypothesisLeads.length > 0) {
        console.log(`Found ${hypothesisLeads.length} hypothesis leads without email_html`);

        for (const lead of hypothesisLeads) {
          try {
            // Call render-email-preview to generate the HTML
            const { data: previewData, error: previewError } = await supabase.functions.invoke(
              "render-email-preview",
              {
                body: {
                  leadId: lead.id,
                  leadType: "hypothesis",
                  score: lead.score,
                  totalQuestions: lead.total_questions,
                  language: lead.language || "en",
                  quizId: lead.quiz_id,
                  openMindednessScore: lead.openness_score,
                },
              }
            );

            if (previewError) {
              console.error(`Error generating preview for hypothesis lead ${lead.id}:`, previewError);
              results.errors++;
              results.details.push(`Hypothesis ${lead.id}: preview error - ${previewError.message}`);
              continue;
            }

            const { html, subject } = previewData;

            if (!html) {
              console.log(`No HTML generated for hypothesis lead ${lead.id}`);
              results.skipped++;
              results.details.push(`Hypothesis ${lead.id}: no HTML generated`);
              continue;
            }

            // Update the lead with the generated HTML
            const { error: updateError } = await supabase
              .from("hypothesis_leads")
              .update({ email_html: html, email_subject: subject })
              .eq("id", lead.id);

            if (updateError) {
              console.error(`Error updating hypothesis lead ${lead.id}:`, updateError);
              results.errors++;
              results.details.push(`Hypothesis ${lead.id}: update error - ${updateError.message}`);
            } else {
              console.log(`Successfully backfilled hypothesis lead ${lead.id}`);
              results.processed++;
            }
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error(`Exception processing hypothesis lead ${lead.id}:`, err);
            results.errors++;
            results.details.push(`Hypothesis ${lead.id}: exception - ${errorMessage}`);
          }
        }
      } else {
        results.details.push("No hypothesis leads found without email_html");
      }
    }

    console.log("Backfill complete:", results);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Backfill error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
