import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuizResultsRequest {
  email: string;
  totalScore: number;
  maxScore: number;
  resultTitle: string;
  resultDescription: string;
  insights: string[];
  answers?: Array<{ questionId: number; selectedOption: number }>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-quiz-results function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, totalScore, maxScore, resultTitle, resultDescription, insights, answers }: QuizResultsRequest = await req.json();

    console.log("Processing quiz results for:", email);
    console.log("Score:", totalScore, "/", maxScore);

    // Save lead to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: insertError } = await supabase.from("quiz_leads").insert({
      email,
      score: totalScore,
      total_questions: maxScore,
      result_category: resultTitle,
      answers: answers || null,
    });

    if (insertError) {
      console.error("Error saving lead to database:", insertError);
    } else {
      console.log("Lead saved to database successfully");
    }

    const insightsList = insights.map((insight, i) => `<li style="margin-bottom: 8px;">${i + 1}. ${insight}</li>`).join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #faf7f5; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6d28d9; font-size: 28px; margin: 0;">Your Team Performance Results</h1>
          </div>
          
          <div style="text-align: center; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: white; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
            <div style="font-size: 48px; font-weight: bold; margin-bottom: 8px;">${totalScore}</div>
            <div style="opacity: 0.9;">out of ${maxScore} points</div>
          </div>
          
          <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">${resultTitle}</h2>
          
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 24px;">${resultDescription}</p>
          
          <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">Key Insights:</h3>
          <ul style="color: #6b7280; line-height: 1.8; padding-left: 20px; margin-bottom: 30px;">
            ${insightsList}
          </ul>
          
          <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 14px; margin-bottom: 12px;">Want to improve your team's performance?</p>
            <a href="https://sparkly.hr" style="display: inline-block; background: #6d28d9; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Visit Sparkly.hr</a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px;">© 2025 Sparkly.hr</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send to user
    const userEmailResponse = await resend.emails.send({
      from: "Sparkly.hr <mikk.orglaan@gmail.com>",
      to: [email],
      subject: `Your Team Performance Results: ${resultTitle}`,
      html: emailHtml,
    });

    console.log("User email sent:", userEmailResponse);

    // Send copy to Sparkly team
    const adminEmailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
        <h2>New Quiz Submission</h2>
        <p><strong>User Email:</strong> ${email}</p>
        <p><strong>Score:</strong> ${totalScore} / ${maxScore}</p>
        <p><strong>Result:</strong> ${resultTitle}</p>
        <hr>
        <h3>Insights:</h3>
        <ul>${insightsList}</ul>
      </body>
      </html>
    `;

    const adminEmailResponse = await resend.emails.send({
      from: "Sparkly.hr Quiz <mikk.orglaan@gmail.com>",
      to: ["mikk.orglaan@gmail.com"],
      subject: `New Quiz Lead: ${email} - ${resultTitle}`,
      html: adminEmailHtml,
    });

    console.log("Admin email sent:", adminEmailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-quiz-results:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
