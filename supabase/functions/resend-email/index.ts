import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendRequest {
  logId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("resend-email function called");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - admin role required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { logId }: ResendRequest = await req.json();

    if (!logId) {
      return new Response(
        JSON.stringify({ error: "logId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch the original email log
    const { data: emailLog, error: logError } = await supabase
      .from("email_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (logError || !emailLog) {
      console.error("Error fetching email log:", logError);
      return new Response(
        JSON.stringify({ error: "Email log not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Resending email to:", emailLog.recipient_email);
    console.log("Subject:", emailLog.subject);

    // Fetch live email template for the HTML content
    const { data: templateData } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_type", "quiz_results")
      .eq("is_live", true)
      .limit(1)
      .maybeSingle();

    const senderName = templateData?.sender_name || emailLog.sender_name || "Sparkly.hr";
    const senderEmail = templateData?.sender_email || emailLog.sender_email || "support@sparkly.hr";

    // Use the original email HTML body if available, otherwise create a fallback
    const emailHtml = emailLog.html_body || `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #faf7f5; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://sparkly.hr/wp-content/uploads/2025/06/sparkly-logo.png" alt="Sparkly.hr" style="height: 48px; margin-bottom: 20px;" />
            <h1 style="color: #6d28d9; font-size: 24px; margin: 0;">Email Resent</h1>
          </div>
          
          <p style="color: #6b7280; line-height: 1.6;">This is a resend of a previous email.</p>
          
          <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Original Subject:</strong> ${emailLog.subject}</p>
            <p style="margin: 0;"><strong>Language:</strong> ${emailLog.language || 'en'}</p>
          </div>
          
          <p style="color: #6b7280; line-height: 1.6;">Please visit <a href="https://sparkly.hr" style="color: #6d28d9;">sparkly.hr</a> for more information about your team's performance assessment.</p>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2025 Sparkly.hr</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send the email with original content
    const emailResponse = await resend.emails.send({
      from: `${senderName} <${senderEmail}>`,
      to: [emailLog.recipient_email],
      subject: emailLog.subject,
      html: emailHtml,
    });

    console.log("Resend response:", JSON.stringify(emailResponse));

    const newAttempts = (emailLog.resend_attempts || 0) + 1;
    const now = new Date().toISOString();

    if (emailResponse.error) {
      // Update the log with failed resend attempt
      await supabase
        .from("email_logs")
        .update({
          resend_attempts: newAttempts,
          last_attempt_at: now,
          error_message: emailResponse.error.message,
        })
        .eq("id", logId);

      console.error("Resend failed:", emailResponse.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: emailResponse.error.message,
          attempts: newAttempts 
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update the original log to mark as successfully resent
    await supabase
      .from("email_logs")
      .update({
        status: "sent",
        resend_attempts: newAttempts,
        last_attempt_at: now,
        resend_id: emailResponse.data?.id || null,
        error_message: null,
      })
      .eq("id", logId);

    // Log the new resend as a separate entry with HTML body
    await supabase.from("email_logs").insert({
      email_type: emailLog.email_type,
      recipient_email: emailLog.recipient_email,
      sender_email: senderEmail,
      sender_name: senderName,
      subject: emailLog.subject,
      status: "sent",
      resend_id: emailResponse.data?.id || null,
      language: emailLog.language,
      quiz_lead_id: emailLog.quiz_lead_id,
      original_log_id: logId,
      html_body: emailHtml,
    });

    console.log("Email resent successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        resendId: emailResponse.data?.id,
        attempts: newAttempts 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in resend-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
