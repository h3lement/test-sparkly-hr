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

    const body = await req.json();
    const { action, userId, userIds, email, name, password } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Action is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Handle get-users-status action - returns email and active status for multiple users
    if (action === "get-users-status") {
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "userIds array is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Fetching status for ${userIds.length} users`);

      const usersData: Record<string, { email: string; name: string; is_active: boolean }> = {};
      
      for (const uid of userIds) {
        try {
          const { data: userData, error: userFetchError } = await adminClient.auth.admin.getUserById(uid);
          if (!userFetchError && userData?.user) {
            // Check if user is banned by casting to unknown first then to Record
            const userObj = userData.user as unknown as Record<string, unknown>;
            const bannedUntil = userObj.banned_until as string | null;
            const userMetadata = userData.user.user_metadata as Record<string, unknown> | undefined;
            const fullName = userMetadata?.full_name as string | undefined;
            usersData[uid] = {
              email: userData.user.email || "Unknown",
              name: fullName || "",
              is_active: !bannedUntil || new Date(bannedUntil) < new Date(),
            };
          } else {
            usersData[uid] = { email: "Unknown", name: "", is_active: true };
          }
        } catch (e) {
          console.error(`Failed to fetch user ${uid}:`, e);
          usersData[uid] = { email: "Unknown", name: "", is_active: true };
        }
      }

      return new Response(
        JSON.stringify({ success: true, users: usersData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All other actions require userId
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required for this action" }),
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