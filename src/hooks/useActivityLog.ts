import { supabase } from "@/integrations/supabase/client";

interface LogActivityParams {
  actionType: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE";
  tableName: string;
  recordId: string;
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
  description?: string;
}

export async function logActivity({
  actionType,
  tableName,
  recordId,
  fieldName,
  oldValue,
  newValue,
  description,
}: LogActivityParams) {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from("activity_logs").insert({
      user_id: user?.id || null,
      user_email: user?.email || null,
      action_type: actionType,
      table_name: tableName,
      record_id: recordId,
      field_name: fieldName || null,
      old_value: oldValue || null,
      new_value: newValue || null,
      description: description || null,
    });

    if (error) {
      console.error("Error logging activity:", error);
    }
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

export function useActivityLog() {
  return { logActivity };
}
