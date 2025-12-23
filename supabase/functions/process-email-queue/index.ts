import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 10;
const PROCESSING_TIMEOUT_MINUTES = 5;

interface EmailQueueItem {
  id: string;
  recipient_email: string;
  sender_email: string;
  sender_name: string;
  subject: string;
  html_body: string;
  email_type: string;
  retry_count: number;
  max_retries: number;
  quiz_lead_id: string | null;
  quiz_id: string | null;
  language: string | null;
  reply_to_email: string | null;
}

interface EmailConfig {
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpTls: boolean;
}

async function getEmailConfig(supabase: any): Promise<EmailConfig> {
  const defaults: EmailConfig = {
    smtpHost: "",
    smtpPort: "587",
    smtpUsername: "",
    smtpPassword: "",
    smtpTls: true,
  };

  try {
    const settingKeys = ["smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_tls"];
    
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", settingKeys);
    
    if (!error && data && data.length > 0) {
      data.forEach((setting: { setting_key: string; setting_value: string }) => {
        switch (setting.setting_key) {
          case "smtp_host": defaults.smtpHost = setting.setting_value; break;
          case "smtp_port": defaults.smtpPort = setting.setting_value || defaults.smtpPort; break;
          case "smtp_username": defaults.smtpUsername = setting.setting_value; break;
          case "smtp_password": defaults.smtpPassword = setting.setting_value; break;
          case "smtp_tls": defaults.smtpTls = setting.setting_value === "true"; break;
        }
      });
      console.log("Loaded SMTP config:", {
        smtpHost: defaults.smtpHost,
        smtpPort: defaults.smtpPort,
        smtpTls: defaults.smtpTls,
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

function isLatin1(str: string): boolean {
  return /^[\x00-\xFF]*$/.test(str);
}

function hasResendConfigured(): boolean {
  return !!Deno.env.get("RESEND_API_KEY");
}

function hasSmtpConfigured(config: EmailConfig): boolean {
  return !!(config.smtpHost && config.smtpUsername && config.smtpPassword);
}

async function sendEmailViaResend(
  item: EmailQueueItem
): Promise<{ success: boolean; error: string | null; messageId?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const from = `${item.sender_name} <${item.sender_email}>`;

    const { data, error } = await resend.emails.send({
      from,
      to: [item.recipient_email],
      subject: item.subject,
      html: item.html_body,
      ...(item.reply_to_email ? { reply_to: item.reply_to_email } : {}),
    });

    if (error) {
      return { success: false, error: (error as any).message ?? String(error) };
    }

    return { success: true, error: null, messageId: (data as any)?.id };
  } catch (error: any) {
    console.error("Resend send error:", error);
    return { success: false, error: error?.message || "Resend send failed" };
  }
}

async function sendEmailViaSMTP(
  config: EmailConfig,
  item: EmailQueueItem
): Promise<{ success: boolean; error: string | null; messageId?: string }> {
  if (!hasSmtpConfigured(config)) {
    return { success: false, error: "SMTP not configured - missing host, username, or password" };
  }

  // Check for Latin1 compatibility
  if (!isLatin1(config.smtpUsername) || !isLatin1(config.smtpPassword)) {
    return {
      success: false,
      error: "SMTP credentials contain non-Latin1 characters. Configure Resend API or use ASCII-only SMTP credentials.",
    };
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: config.smtpHost,
        port: parseInt(config.smtpPort, 10) || 587,
        tls: config.smtpTls,
        auth: {
          username: config.smtpUsername,
          password: config.smtpPassword,
        },
      },
    });

    const from = `${item.sender_name} <${item.sender_email}>`;
    const encodedSubject = encodeSubject(item.subject);

    await client.send({
      from,
      to: [item.recipient_email],
      subject: encodedSubject,
      content: item.html_body,
      html: item.html_body,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Content-Transfer-Encoding": "quoted-printable",
      },
      ...(item.reply_to_email ? { replyTo: item.reply_to_email } : {}),
    });

    await client.close();

    const messageId = `smtp-${Date.now()}-${item.id.slice(0, 8)}`;
    return { success: true, error: null, messageId };
  } catch (error: any) {
    console.error("SMTP send error:", error);
    return { success: false, error: error?.message || "SMTP send failed" };
  }
}

async function sendEmail(
  config: EmailConfig,
  item: EmailQueueItem
): Promise<{ success: boolean; error: string | null; messageId?: string }> {
  // Prefer Resend API if configured (avoids SMTP Latin1 issues)
  if (hasResendConfigured()) {
    console.log(`Sending via Resend to: ${item.recipient_email}`);
    return await sendEmailViaResend(item);
  }

  // Fall back to SMTP
  console.log(`Sending via SMTP to: ${item.recipient_email}`);
  return await sendEmailViaSMTP(config, item);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("process-email-queue function called");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get SMTP config from database
    const emailConfig = await getEmailConfig(supabase);

    if (!emailConfig.smtpHost) {
      console.error("SMTP not configured");
      return new Response(
        JSON.stringify({ error: "SMTP not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Reset stuck processing items (older than timeout)
    const timeoutThreshold = new Date(Date.now() - PROCESSING_TIMEOUT_MINUTES * 60 * 1000).toISOString();
    const { data: stuckItems } = await supabase
      .from("email_queue")
      .update({ status: "pending", processing_started_at: null })
      .eq("status", "processing")
      .lt("processing_started_at", timeoutThreshold)
      .select("id");
    
    if (stuckItems && stuckItems.length > 0) {
      console.log(`Reset ${stuckItems.length} stuck processing items`);
    }

    // Fetch pending emails ready to be sent
    const { data: pendingEmails, error: fetchError } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Error fetching pending emails:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log("No pending emails to process");
      return new Response(
        JSON.stringify({ processed: 0, sent: 0, failed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Processing ${pendingEmails.length} pending emails`);

    // Mark items as processing
    const emailIds = pendingEmails.map((e: EmailQueueItem) => e.id);
    await supabase
      .from("email_queue")
      .update({ status: "processing", processing_started_at: new Date().toISOString() })
      .in("id", emailIds);

    let sent = 0;
    let failed = 0;

    for (const email of pendingEmails as EmailQueueItem[]) {
      console.log(`Sending email to: ${email.recipient_email}, type: ${email.email_type}`);
      
      const result = await sendEmail(emailConfig, email);

      if (result.success) {
        // Update queue item as sent
        await supabase
          .from("email_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", email.id);

        // Log to email_logs
        await supabase.from("email_logs").insert({
          email_type: email.email_type,
          recipient_email: email.recipient_email,
          sender_email: email.sender_email,
          sender_name: email.sender_name,
          subject: email.subject,
          status: "sent",
          resend_id: result.messageId || null,
          language: email.language,
          quiz_lead_id: email.quiz_lead_id,
          quiz_id: email.quiz_id,
          html_body: email.html_body,
          delivery_status: "sent",
        });

        sent++;
        console.log(`Email sent successfully to: ${email.recipient_email}`);
      } else {
        const newRetryCount = email.retry_count + 1;
        const isFinalFailure = newRetryCount >= email.max_retries;

        // Update queue item
        await supabase
          .from("email_queue")
          .update({
            status: isFinalFailure ? "failed" : "pending",
            retry_count: newRetryCount,
            error_message: result.error,
            processing_started_at: null,
            // Exponential backoff: 1min, 2min, 4min...
            scheduled_for: isFinalFailure 
              ? new Date().toISOString()
              : new Date(Date.now() + Math.pow(2, newRetryCount) * 60 * 1000).toISOString(),
          })
          .eq("id", email.id);

        if (isFinalFailure) {
          // Log final failure to email_logs
          await supabase.from("email_logs").insert({
            email_type: email.email_type,
            recipient_email: email.recipient_email,
            sender_email: email.sender_email,
            sender_name: email.sender_name,
            subject: email.subject,
            status: "failed",
            error_message: result.error,
            language: email.language,
            quiz_lead_id: email.quiz_lead_id,
            quiz_id: email.quiz_id,
            html_body: email.html_body,
            resend_attempts: newRetryCount,
            delivery_status: "failed",
          });
        }

        failed++;
        console.error(`Email failed to: ${email.recipient_email}, error: ${result.error}, retry: ${newRetryCount}/${email.max_retries}`);
      }
    }

    console.log(`Processed ${pendingEmails.length} emails: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ processed: pendingEmails.length, sent, failed }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in process-email-queue:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
