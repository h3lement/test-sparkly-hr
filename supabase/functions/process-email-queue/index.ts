import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

async function sendEmail(
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("process-email-queue function called");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      
      const result = await sendEmail(email);

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
