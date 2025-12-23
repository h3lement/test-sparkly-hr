import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getSafeQuizLeadId(supabase: any, quizLeadId: string | null): Promise<string | null> {
  if (!quizLeadId) return null;
  const { data, error } = await supabase
    .from("quiz_leads")
    .select("id")
    .eq("id", quizLeadId)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data.id;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("backfill-email-logs function called");

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

    // Fetch all sent queue items
    const { data: sentQueueItems, error: queueError } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "sent")
      .order("sent_at", { ascending: false });

    if (queueError) {
      console.error("Error fetching queue items:", queueError);
      return new Response(
        JSON.stringify({ error: queueError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!sentQueueItems || sentQueueItems.length === 0) {
      console.log("No sent queue items to backfill");
      return new Response(
        JSON.stringify({ backfilled: 0, message: "No sent queue items found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${sentQueueItems.length} sent queue items to check`);

    let backfilledCount = 0;
    const errors: string[] = [];

    for (const queueItem of sentQueueItems) {
      // Check if this queue item already has a corresponding email_log entry
      // Match by recipient_email + subject + approximate time (within 5 minutes of sent_at)
      const sentAt = new Date(queueItem.sent_at);
      const timeWindowStart = new Date(sentAt.getTime() - 5 * 60 * 1000).toISOString();
      const timeWindowEnd = new Date(sentAt.getTime() + 5 * 60 * 1000).toISOString();

      const { data: existingLog } = await supabase
        .from("email_logs")
        .select("id")
        .eq("recipient_email", queueItem.recipient_email)
        .eq("subject", queueItem.subject)
        .gte("created_at", timeWindowStart)
        .lte("created_at", timeWindowEnd)
        .maybeSingle();

      if (existingLog) {
        // Already has a log entry, skip
        continue;
      }

      // Create the missing log entry
      const safeQuizLeadId = await getSafeQuizLeadId(supabase, queueItem.quiz_lead_id);

      const { error: insertError } = await supabase.from("email_logs").insert({
        email_type: queueItem.email_type,
        recipient_email: queueItem.recipient_email,
        sender_email: queueItem.sender_email,
        sender_name: queueItem.sender_name,
        subject: queueItem.subject,
        status: "sent",
        resend_id: `backfill-${queueItem.id}`,
        language: queueItem.language,
        quiz_lead_id: safeQuizLeadId,
        quiz_id: queueItem.quiz_id,
        html_body: queueItem.html_body,
        delivery_status: "sent",
        created_at: queueItem.sent_at, // Use the original sent time
      });

      if (insertError) {
        console.error(`Error backfilling queue item ${queueItem.id}:`, insertError.message);
        errors.push(`${queueItem.recipient_email}: ${insertError.message}`);
      } else {
        backfilledCount++;
        console.log(`Backfilled log for: ${queueItem.recipient_email}`);
      }
    }

    console.log(`Backfill complete: ${backfilledCount} logs created`);

    return new Response(
      JSON.stringify({
        backfilled: backfilledCount,
        total_checked: sentQueueItems.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in backfill-email-logs:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
