import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailConfig {
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpTls: boolean;
}

async function getEmailConfig(supabase: any): Promise<EmailConfig> {
  const defaults: EmailConfig = {
    senderName: "Sparkly",
    senderEmail: "noreply@sparkly.hr",
    replyToEmail: "",
    smtpHost: "",
    smtpPort: "587",
    smtpUsername: "",
    smtpPassword: "",
    smtpTls: true,
  };

  try {
    const settingKeys = [
      "email_sender_name", "email_sender_email", "email_reply_to",
      "smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_tls"
    ];
    
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", settingKeys);
    
    if (!error && data && data.length > 0) {
      data.forEach((setting: { setting_key: string; setting_value: string }) => {
        switch (setting.setting_key) {
          case "email_sender_name": defaults.senderName = setting.setting_value || defaults.senderName; break;
          case "email_sender_email": defaults.senderEmail = setting.setting_value || defaults.senderEmail; break;
          case "email_reply_to": defaults.replyToEmail = setting.setting_value; break;
          case "smtp_host": defaults.smtpHost = setting.setting_value; break;
          case "smtp_port": defaults.smtpPort = setting.setting_value || defaults.smtpPort; break;
          case "smtp_username": defaults.smtpUsername = setting.setting_value; break;
          case "smtp_password": defaults.smtpPassword = setting.setting_value; break;
          case "smtp_tls": defaults.smtpTls = setting.setting_value === "true"; break;
        }
      });
    }
  } catch (error) {
    console.error("Error fetching email config:", error);
  }
  
  return defaults;
}

// Encode subject line for UTF-8 support (RFC 2047)
function encodeSubject(subject: string): string {
  if (!/^[\x00-\x7F]*$/.test(subject)) {
    const encoded = btoa(unescape(encodeURIComponent(subject)));
    return `=?UTF-8?B?${encoded}?=`;
  }
  return subject;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface HypothesisAdminEmailRequest {
  email: string;
  score: number;
  totalQuestions: number;
  quizId: string;
  quizTitle: string;
  language: string;
  feedbackNewLearnings?: string | null;
  feedbackActionPlan?: string | null;
  leadId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: HypothesisAdminEmailRequest = await req.json();
    const { email, score, totalQuestions, quizId, quizTitle, language, feedbackNewLearnings, feedbackActionPlan, leadId } = body;

    console.log("Sending hypothesis admin email for:", email);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for duplicate - skip if admin email already sent/queued for this lead
    if (leadId) {
      const { data: existingEmail } = await supabase
        .from("email_queue")
        .select("id")
        .eq("hypothesis_lead_id", leadId)
        .eq("email_type", "quiz_result_admin")
        .in("status", ["pending", "processing", "sent"])
        .limit(1)
        .maybeSingle();

      if (existingEmail) {
        console.log("Admin email already queued/sent for lead:", leadId);
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "duplicate" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Also check email_logs
      const { data: existingLog } = await supabase
        .from("email_logs")
        .select("id")
        .eq("hypothesis_lead_id", leadId)
        .eq("email_type", "quiz_result_admin")
        .limit(1)
        .maybeSingle();

      if (existingLog) {
        console.log("Admin email already logged for lead:", leadId);
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "duplicate" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const emailConfig = await getEmailConfig(supabase);

    if (!emailConfig.smtpHost || !emailConfig.smtpUsername || !emailConfig.smtpPassword) {
      console.error("SMTP not configured");
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const percentage = Math.round((score / totalQuestions) * 100);
    const safeEmail = escapeHtml(email);
    const safeQuizTitle = escapeHtml(quizTitle);
    const safeFeedbackLearnings = feedbackNewLearnings ? escapeHtml(feedbackNewLearnings) : 'Not provided';
    const safeFeedbackPlan = feedbackActionPlan ? escapeHtml(feedbackActionPlan) : 'Not provided';

    const logoUrl = "https://sparkly.hr/wp-content/uploads/2025/06/sparkly-logo.png";

    const adminEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${logoUrl}" alt="Sparkly.hr" style="height: 40px; margin-bottom: 16px;" />
            <h1 style="color: #1f2937; font-size: 24px; margin: 0;">New Hypothesis Quiz Submission</h1>
          </div>
          
          <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0;"><strong>Quiz:</strong> ${safeQuizTitle}</p>
            <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${safeEmail}</p>
            <p style="margin: 0 0 8px 0;"><strong>Score:</strong> ${score} / ${totalQuestions} (${percentage}%)</p>
            <p style="margin: 0;"><strong>Language:</strong> ${language.toUpperCase()}</p>
          </div>
          
          <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 12px;">User Feedback:</h3>
          
          <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0; color: #92400e; font-weight: 600;">New Learnings:</p>
            <p style="margin: 0; color: #78350f; white-space: pre-wrap;">${safeFeedbackLearnings}</p>
          </div>
          
          <div style="background: #d1fae5; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; color: #065f46; font-weight: 600;">Action Plan:</p>
            <p style="margin: 0; color: #064e3b; white-space: pre-wrap;">${safeFeedbackPlan}</p>
          </div>
          
          <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px;">&copy; 2025 Sparkly.hr</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const adminEmailSubject = `New Hypothesis Lead: ${safeEmail} - ${percentage}%`;

    // Queue the email
    const { error: queueError } = await supabase.from("email_queue").insert({
      recipient_email: "mikk@sparkly.hr",
      sender_email: emailConfig.senderEmail,
      sender_name: `${emailConfig.senderName} Quiz`,
      subject: adminEmailSubject,
      html_body: adminEmailHtml,
      email_type: "quiz_result_admin",
      hypothesis_lead_id: leadId || null,
      quiz_id: quizId || null,
      language: language,
      reply_to_email: emailConfig.replyToEmail || null,
    });

    if (queueError) {
      console.error("Error queuing admin email:", queueError);
      return new Response(JSON.stringify({ error: "Failed to queue email" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Hypothesis admin email queued successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-hypothesis-admin-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
