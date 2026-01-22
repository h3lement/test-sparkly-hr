# Email System Blueprint

Complete documentation for SMTP-based email sending system with queue, logging, and admin UI.

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [Edge Functions](#2-edge-functions)
3. [Frontend Components](#3-frontend-components)
4. [Configuration](#4-configuration)
5. [Cron Jobs](#5-cron-jobs)

---

## 1. Database Schema

### 1.1 Core Tables

Run these migrations in order:

```sql
-- 1. Create app_role enum (if not exists)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Create has_role function for RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 3. User roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage roles" ON public.user_roles
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);
```

### 1.2 App Settings Table

```sql
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read settings" ON public.app_settings
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert settings" ON public.app_settings
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update settings" ON public.app_settings
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete settings" ON public.app_settings
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 1.3 Email Queue Table

```sql
CREATE TABLE public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  sender_email text NOT NULL,
  sender_name text NOT NULL,
  reply_to_email text,
  subject text NOT NULL,
  html_body text NOT NULL,
  email_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  language text DEFAULT 'en',
  -- Optional: link to your leads table
  quiz_id uuid,
  quiz_lead_id uuid,
  hypothesis_lead_id uuid
);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email queue" ON public.email_queue
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update email queue" ON public.email_queue
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete email queue" ON public.email_queue
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for processing
CREATE INDEX idx_email_queue_pending ON public.email_queue (status, scheduled_for) 
WHERE status = 'pending';
```

### 1.4 Email Logs Table

```sql
CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  sender_email text NOT NULL,
  sender_name text NOT NULL,
  subject text NOT NULL,
  html_body text,
  email_type text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  resend_id text,
  resend_attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  original_log_id uuid REFERENCES public.email_logs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Delivery tracking
  delivery_status text DEFAULT 'sent',
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  bounce_type text,
  bounce_reason text,
  complaint_type text,
  open_count integer DEFAULT 0,
  click_count integer DEFAULT 0,
  provider_response jsonb DEFAULT '{}'::jsonb,
  language text,
  -- Optional: link to your leads table
  quiz_id uuid,
  quiz_lead_id uuid,
  hypothesis_lead_id uuid
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email logs" ON public.email_logs
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete email logs" ON public.email_logs
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_email_logs_recipient ON public.email_logs (recipient_email);
CREATE INDEX idx_email_logs_created_at ON public.email_logs (created_at DESC);
CREATE INDEX idx_email_logs_status ON public.email_logs (status);
```

### 1.5 Pending Email Notifications (Backup System)

```sql
CREATE TABLE public.pending_email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_type text NOT NULL, -- 'quiz' or 'hypothesis' or your custom type
  lead_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_type, lead_id)
);

ALTER TABLE public.pending_email_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pending notifications" ON public.pending_email_notifications
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert notifications" ON public.pending_email_notifications
FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update notifications" ON public.pending_email_notifications
FOR UPDATE USING (true);
```

---

## 2. Edge Functions

### 2.1 process-email-queue (Main SMTP Sender)

**File:** `supabase/functions/process-email-queue/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  smtpTls: boolean;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
}

async function getEmailConfig(supabase: any): Promise<EmailConfig> {
  const defaults: EmailConfig = {
    smtpHost: "",
    smtpPort: 465,
    smtpUsername: "",
    smtpPassword: "",
    smtpTls: true,
    senderName: "Notifications",
    senderEmail: "noreply@example.com",
    replyToEmail: "",
  };

  const settingKeys = [
    "smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_tls",
    "email_sender_name", "email_sender_email", "email_reply_to"
  ];

  const { data } = await supabase
    .from("app_settings")
    .select("setting_key, setting_value")
    .in("setting_key", settingKeys);

  if (data) {
    for (const s of data) {
      switch (s.setting_key) {
        case "smtp_host": defaults.smtpHost = s.setting_value; break;
        case "smtp_port": defaults.smtpPort = parseInt(s.setting_value) || 465; break;
        case "smtp_username": defaults.smtpUsername = s.setting_value; break;
        case "smtp_password": defaults.smtpPassword = s.setting_value; break;
        case "smtp_tls": defaults.smtpTls = s.setting_value !== "false"; break;
        case "email_sender_name": defaults.senderName = s.setting_value; break;
        case "email_sender_email": defaults.senderEmail = s.setting_value; break;
        case "email_reply_to": defaults.replyToEmail = s.setting_value; break;
      }
    }
  }

  return defaults;
}

async function sendEmailViaSMTP(
  config: EmailConfig,
  to: string,
  subject: string,
  htmlBody: string,
  replyTo?: string
): Promise<{ success: boolean; error?: string }> {
  if (!config.smtpHost || !config.smtpUsername || !config.smtpPassword) {
    return { success: false, error: "SMTP not configured" };
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: config.smtpHost,
        port: config.smtpPort,
        tls: config.smtpTls,
        auth: {
          username: config.smtpUsername,
          password: config.smtpPassword,
        },
      },
    });

    await client.send({
      from: `${config.senderName} <${config.senderEmail}>`,
      to: to,
      subject: subject,
      content: "Please view this email in an HTML-capable client.",
      html: htmlBody,
      replyTo: replyTo || config.replyToEmail || undefined,
    });

    await client.close();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("process-email-queue function called");

  try {
    // Check if email sending is enabled
    const { data: enabledSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "email_sending_enabled")
      .maybeSingle();

    if (enabledSetting?.setting_value === "false") {
      console.log("Email sending is disabled");
      return new Response(JSON.stringify({ message: "Email sending disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = await getEmailConfig(supabase);
    console.log("Loaded SMTP config:", { 
      smtpHost: config.smtpHost, 
      smtpPort: config.smtpPort, 
      smtpTls: config.smtpTls 
    });

    // Fetch pending emails (limit to 10 per run)
    const { data: pendingEmails, error: fetchError } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchError) throw fetchError;

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log("No pending emails to process");
      return new Response(JSON.stringify({ message: "No pending emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${pendingEmails.length} pending emails`);

    let sent = 0;
    let failed = 0;

    for (const email of pendingEmails) {
      // Mark as processing
      await supabase
        .from("email_queue")
        .update({ 
          status: "processing", 
          processing_started_at: new Date().toISOString() 
        })
        .eq("id", email.id);

      console.log(`Sending email to: ${email.recipient_email}, type: ${email.email_type}`);

      const result = await sendEmailViaSMTP(
        config,
        email.recipient_email,
        email.subject,
        email.html_body,
        email.reply_to_email
      );

      if (result.success) {
        // Move to logs
        await supabase.from("email_logs").insert({
          recipient_email: email.recipient_email,
          sender_email: email.sender_email || config.senderEmail,
          sender_name: email.sender_name || config.senderName,
          subject: email.subject,
          html_body: email.html_body,
          email_type: email.email_type,
          status: "sent",
          delivery_status: "sent",
          language: email.language,
          quiz_id: email.quiz_id,
          quiz_lead_id: email.quiz_lead_id,
          hypothesis_lead_id: email.hypothesis_lead_id,
        });

        // Update queue status
        await supabase
          .from("email_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", email.id);

        console.log(`Email sent successfully to: ${email.recipient_email}`);
        sent++;
      } else {
        const newRetryCount = email.retry_count + 1;
        const shouldRetry = newRetryCount < email.max_retries;

        await supabase
          .from("email_queue")
          .update({
            status: shouldRetry ? "pending" : "failed",
            error_message: result.error,
            retry_count: newRetryCount,
            processing_started_at: null,
          })
          .eq("id", email.id);

        if (!shouldRetry) {
          // Log failed email
          await supabase.from("email_logs").insert({
            recipient_email: email.recipient_email,
            sender_email: email.sender_email || config.senderEmail,
            sender_name: email.sender_name || config.senderName,
            subject: email.subject,
            html_body: email.html_body,
            email_type: email.email_type,
            status: "failed",
            error_message: result.error,
            language: email.language,
            quiz_id: email.quiz_id,
          });
        }

        console.error(`Failed to send email to ${email.recipient_email}: ${result.error}`);
        failed++;
      }
    }

    console.log(`Processed ${pendingEmails.length} emails: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ processed: pendingEmails.length, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing email queue:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### 2.2 resend-email (Manual Resend)

**File:** `supabase/functions/resend-email/index.ts`

```typescript
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
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { logId } = await req.json();
    if (!logId) {
      return new Response(JSON.stringify({ error: "Missing logId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch original email log
    const { data: originalLog, error: fetchError } = await supabase
      .from("email_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (fetchError || !originalLog) {
      return new Response(JSON.stringify({ error: "Email log not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Queue for resend
    const { error: queueError } = await supabase.from("email_queue").insert({
      recipient_email: originalLog.recipient_email,
      sender_email: originalLog.sender_email,
      sender_name: originalLog.sender_name,
      subject: originalLog.subject,
      html_body: originalLog.html_body,
      email_type: originalLog.email_type,
      language: originalLog.language,
      quiz_id: originalLog.quiz_id,
      quiz_lead_id: originalLog.quiz_lead_id,
    });

    if (queueError) {
      throw queueError;
    }

    // Update original log
    await supabase
      .from("email_logs")
      .update({
        resend_attempts: (originalLog.resend_attempts || 0) + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", logId);

    console.log(`Email queued for resend: ${originalLog.recipient_email}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email queued for resend" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Resend error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### 2.3 Config.toml Entries

**File:** `supabase/config.toml`

```toml
project_id = "your-project-id"

[functions.process-email-queue]
verify_jwt = false

[functions.resend-email]
verify_jwt = false
```

---

## 3. Frontend Components

### 3.1 EmailSettings Component

**File:** `src/components/admin/EmailSettings.tsx`

```tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, TestTube, Eye, EyeOff } from "lucide-react";

interface EmailConfig {
  smtp_host: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
  smtp_tls: string;
  email_sender_name: string;
  email_sender_email: string;
  email_reply_to: string;
  email_sending_enabled: string;
  admin_notification_email: string;
}

export function EmailSettings() {
  const [config, setConfig] = useState<EmailConfig>({
    smtp_host: "",
    smtp_port: "465",
    smtp_username: "",
    smtp_password: "",
    smtp_tls: "true",
    email_sender_name: "",
    email_sender_email: "",
    email_reply_to: "",
    email_sending_enabled: "true",
    admin_notification_email: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value");

    if (!error && data) {
      const newConfig = { ...config };
      data.forEach((s) => {
        if (s.setting_key in newConfig) {
          (newConfig as any)[s.setting_key] = s.setting_value;
        }
      });
      setConfig(newConfig);
    }
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(config)) {
        await supabase
          .from("app_settings")
          .upsert(
            { setting_key: key, setting_value: value },
            { onConflict: "setting_key" }
          );
      }
      toast.success("Settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
    }
    setSaving(false);
  }

  async function testConnection() {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-email-queue", {
        body: { test: true },
      });
      
      if (error) throw error;
      toast.success("SMTP connection successful");
    } catch (error) {
      toast.error("SMTP connection failed");
    }
    setTesting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Sending Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Email Sending</CardTitle>
          <CardDescription>Enable or disable all outgoing emails</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="email-enabled">Email Sending Enabled</Label>
            <Switch
              id="email-enabled"
              checked={config.email_sending_enabled === "true"}
              onCheckedChange={(checked) =>
                setConfig({ ...config, email_sending_enabled: checked ? "true" : "false" })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* SMTP Settings */}
      <Card>
        <CardHeader>
          <CardTitle>SMTP Configuration</CardTitle>
          <CardDescription>Configure your SMTP server for sending emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input
                id="smtp-host"
                value={config.smtp_host}
                onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">SMTP Port</Label>
              <Input
                id="smtp-port"
                value={config.smtp_port}
                onChange={(e) => setConfig({ ...config, smtp_port: e.target.value })}
                placeholder="465"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-username">Username</Label>
              <Input
                id="smtp-username"
                value={config.smtp_username}
                onChange={(e) => setConfig({ ...config, smtp_username: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-password">Password</Label>
              <div className="relative">
                <Input
                  id="smtp-password"
                  type={showPassword ? "text" : "password"}
                  value={config.smtp_password}
                  onChange={(e) => setConfig({ ...config, smtp_password: e.target.value })}
                  placeholder="••••••••"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="smtp-tls"
              checked={config.smtp_tls === "true"}
              onCheckedChange={(checked) =>
                setConfig({ ...config, smtp_tls: checked ? "true" : "false" })
              }
            />
            <Label htmlFor="smtp-tls">Use TLS/SSL</Label>
          </div>

          <Button onClick={testConnection} disabled={testing} variant="outline">
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
            Test Connection
          </Button>
        </CardContent>
      </Card>

      {/* Sender Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Sender Identity</CardTitle>
          <CardDescription>Configure the sender information for outgoing emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sender-name">Sender Name</Label>
              <Input
                id="sender-name"
                value={config.email_sender_name}
                onChange={(e) => setConfig({ ...config, email_sender_name: e.target.value })}
                placeholder="My Company"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sender-email">Sender Email</Label>
              <Input
                id="sender-email"
                type="email"
                value={config.email_sender_email}
                onChange={(e) => setConfig({ ...config, email_sender_email: e.target.value })}
                placeholder="noreply@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reply-to">Reply-To Email</Label>
              <Input
                id="reply-to"
                type="email"
                value={config.email_reply_to}
                onChange={(e) => setConfig({ ...config, email_reply_to: e.target.value })}
                placeholder="support@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Admin Notification Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={config.admin_notification_email}
                onChange={(e) => setConfig({ ...config, admin_notification_email: e.target.value })}
                placeholder="admin@example.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
```

### 3.2 EmailLogsMonitor Component (Simplified)

**File:** `src/components/admin/EmailLogsMonitor.tsx`

```tsx
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Search, Mail, CheckCircle, XCircle, Clock, Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { EmailSettings } from "./EmailSettings";

interface EmailLog {
  id: string;
  recipient_email: string;
  sender_email: string;
  subject: string;
  email_type: string;
  status: string;
  created_at: string;
  html_body?: string;
  error_message?: string;
}

interface QueueItem {
  id: string;
  recipient_email: string;
  subject: string;
  email_type: string;
  status: string;
  created_at: string;
  retry_count: number;
  error_message?: string;
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}.${d.getFullYear()} ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

export function EmailLogsMonitor() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    
    // Real-time subscription
    const channel = supabase
      .channel("email-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "email_logs" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "email_queue" }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchData() {
    setLoading(true);
    
    const [logsRes, queueRes] = await Promise.all([
      supabase
        .from("email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("email_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (logsRes.data) setLogs(logsRes.data);
    if (queueRes.data) setQueue(queueRes.data);
    
    setLoading(false);
  }

  async function handleResend(logId: string) {
    setResending(logId);
    try {
      const { error } = await supabase.functions.invoke("resend-email", {
        body: { logId },
      });
      
      if (error) throw error;
      toast.success("Email queued for resend");
      fetchData();
    } catch (error) {
      toast.error("Failed to resend email");
    }
    setResending(null);
  }

  const filteredLogs = logs.filter(
    (log) =>
      log.recipient_email.toLowerCase().includes(search.toLowerCase()) ||
      log.subject.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: logs.length,
    sent: logs.filter((l) => l.status === "sent").length,
    failed: logs.filter((l) => l.status === "failed").length,
    pending: queue.filter((q) => q.status === "pending").length,
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">
            <Mail className="h-4 w-4 mr-2" />
            Email History
          </TabsTrigger>
          <TabsTrigger value="settings">Email Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.sent}</p>
                    <p className="text-sm text-muted-foreground">Sent</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.failed}</p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Refresh */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={fetchData} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline">{log.email_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={log.status === "sent" ? "default" : "destructive"}
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.recipient_email}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {log.subject}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTimestamp(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleResend(log.id)}
                          disabled={resending === log.id}
                        >
                          <RotateCcw
                            className={`h-4 w-4 ${resending === log.id ? "animate-spin" : ""}`}
                          />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <EmailSettings />
        </TabsContent>
      </Tabs>

      {/* Email Preview Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedLog?.subject}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            {selectedLog?.html_body && (
              <iframe
                srcDoc={selectedLog.html_body}
                className="w-full h-[60vh] border rounded"
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

## 4. Configuration

### 4.1 Required App Settings Keys

Insert these into `app_settings` table for initial setup:

```sql
INSERT INTO app_settings (setting_key, setting_value) VALUES
('email_sending_enabled', 'true'),
('smtp_host', ''),
('smtp_port', '465'),
('smtp_username', ''),
('smtp_password', ''),
('smtp_tls', 'true'),
('email_sender_name', 'My Company'),
('email_sender_email', 'noreply@example.com'),
('email_reply_to', 'support@example.com'),
('admin_notification_email', 'admin@example.com')
ON CONFLICT (setting_key) DO NOTHING;
```

---

## 5. Cron Jobs

Set up cron jobs to process the email queue automatically:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule email queue processing every minute
SELECT cron.schedule(
  'process-email-queue-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-email-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**Replace:**
- `YOUR_PROJECT_REF` with your Supabase project reference
- `YOUR_ANON_KEY` with your Supabase anon key

---

## Quick Start Checklist

1. ✅ Run all database migrations in order
2. ✅ Create edge functions in `supabase/functions/`
3. ✅ Add edge function entries to `supabase/config.toml`
4. ✅ Deploy edge functions
5. ✅ Add frontend components
6. ✅ Configure SMTP settings via admin UI
7. ✅ Set up cron job for queue processing
8. ✅ Create first admin user with `admin` role in `user_roles`

---

## How Emails Flow

1. **Your code queues an email** → Insert into `email_queue` table
2. **Cron job runs every minute** → Calls `process-email-queue` function
3. **Function processes queue** → Sends via SMTP, moves to `email_logs`
4. **Admin monitors in UI** → Views history, can resend failed emails

---

*Generated from Sparkly.hr Quiz Platform - 22.01.2026*
