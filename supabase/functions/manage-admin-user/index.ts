import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, userId, email, name, password } = await req.json();

    if (!action || !userId) {
      return new Response(
        JSON.stringify({ error: "Action and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-modification for critical actions
    if (userId === callerUser.id && (action === "deactivate" || action === "delete")) {
      return new Response(
        JSON.stringify({ error: "Cannot deactivate or delete your own account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case "update": {
        console.log(`Updating admin user: ${userId}`);
        const updateData: Record<string, unknown> = {};
        
        if (email) updateData.email = email.toLowerCase();
        if (name) updateData.user_metadata = { full_name: name };
        if (password && password.length >= 6) updateData.password = password;

        if (Object.keys(updateData).length === 0) {
          return new Response(
            JSON.stringify({ error: "No update data provided" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, updateData);

        if (updateError) {
          console.error("Failed to update user:", updateError);
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update email in profiles table if changed
        if (email) {
          await adminClient
            .from("profiles")
            .update({ email: email.toLowerCase() })
            .eq("user_id", userId);
        }

        return new Response(
          JSON.stringify({ success: true, message: "Admin updated successfully" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "deactivate": {
        console.log(`Deactivating admin user: ${userId}`);
        
        // Ban the user (prevents login)
        const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "876000h", // ~100 years
        });

        if (banError) {
          console.error("Failed to deactivate user:", banError);
          return new Response(
            JSON.stringify({ error: banError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Admin deactivated successfully" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "activate": {
        console.log(`Activating admin user: ${userId}`);
        
        // Unban the user
        const { error: unbanError } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });

        if (unbanError) {
          console.error("Failed to activate user:", unbanError);
          return new Response(
            JSON.stringify({ error: unbanError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Admin activated successfully" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});