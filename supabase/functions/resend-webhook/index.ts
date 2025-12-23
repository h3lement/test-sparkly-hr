import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // Bounce specific
    bounce?: {
      message: string;
      type?: string;
    };
    // Complaint specific
    complaint?: {
      type?: string;
    };
    // Click specific
    click?: {
      link: string;
      timestamp: string;
    };
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Resend webhook received');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ResendWebhookPayload = await req.json();
    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    const { type, data, created_at } = payload;
    const resendId = data.email_id;

    if (!resendId) {
      console.error('No email_id in webhook payload');
      return new Response(JSON.stringify({ error: 'Missing email_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store the webhook event for audit trail
    const { error: eventError } = await supabase
      .from('email_webhook_events')
      .insert({
        resend_id: resendId,
        event_type: type,
        event_data: payload,
        processed: false,
      });

    if (eventError) {
      console.error('Error storing webhook event:', eventError);
    }

    // Find the email log by resend_id
    const { data: emailLog, error: findError } = await supabase
      .from('email_logs')
      .select('id')
      .eq('resend_id', resendId)
      .single();

    if (findError || !emailLog) {
      console.log('Email log not found for resend_id:', resendId);
      // Mark event as processed anyway
      await supabase
        .from('email_webhook_events')
        .update({ processed: true })
        .eq('resend_id', resendId)
        .eq('event_type', type);

      return new Response(JSON.stringify({ status: 'email_not_found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update email_logs based on event type
    let updateData: Record<string, unknown> = {
      provider_response: payload,
    };

    switch (type) {
      case 'email.delivered':
        updateData.delivery_status = 'delivered';
        updateData.delivered_at = created_at;
        console.log('Email delivered:', resendId);
        break;

      case 'email.bounced':
        updateData.delivery_status = 'bounced';
        updateData.bounced_at = created_at;
        updateData.bounce_type = data.bounce?.type || 'unknown';
        updateData.bounce_reason = data.bounce?.message || 'Unknown bounce reason';
        updateData.status = 'failed';
        console.log('Email bounced:', resendId, data.bounce?.message);
        break;

      case 'email.complained':
        updateData.delivery_status = 'complained';
        updateData.complained_at = created_at;
        updateData.complaint_type = data.complaint?.type || 'unknown';
        console.log('Email complaint:', resendId);
        break;

      case 'email.opened':
        // Increment open count and set first opened_at if not set
        const { data: currentLog } = await supabase
          .from('email_logs')
          .select('opened_at, open_count')
          .eq('id', emailLog.id)
          .single();

        updateData.open_count = (currentLog?.open_count || 0) + 1;
        if (!currentLog?.opened_at) {
          updateData.opened_at = created_at;
          updateData.delivery_status = 'opened';
        }
        console.log('Email opened:', resendId);
        break;

      case 'email.clicked':
        // Increment click count and set first clicked_at if not set
        const { data: clickLog } = await supabase
          .from('email_logs')
          .select('clicked_at, click_count')
          .eq('id', emailLog.id)
          .single();

        updateData.click_count = (clickLog?.click_count || 0) + 1;
        if (!clickLog?.clicked_at) {
          updateData.clicked_at = created_at;
          updateData.delivery_status = 'clicked';
        }
        console.log('Email clicked:', resendId, data.click?.link);
        break;

      case 'email.sent':
        updateData.delivery_status = 'sent';
        console.log('Email sent confirmed:', resendId);
        break;

      case 'email.delivery_delayed':
        updateData.delivery_status = 'delayed';
        console.log('Email delayed:', resendId);
        break;

      default:
        console.log('Unknown webhook type:', type);
    }

    // Update the email log
    const { error: updateError } = await supabase
      .from('email_logs')
      .update(updateData)
      .eq('id', emailLog.id);

    if (updateError) {
      console.error('Error updating email log:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update email log' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark webhook event as processed
    await supabase
      .from('email_webhook_events')
      .update({ processed: true })
      .eq('resend_id', resendId)
      .eq('event_type', type);

    console.log('Webhook processed successfully');

    return new Response(JSON.stringify({ status: 'processed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Webhook handler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
