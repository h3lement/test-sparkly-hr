import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseUserPreferencesOptions {
  key: string;
  defaultValue?: Record<string, any>;
}

export function useUserPreferences<T extends Record<string, any>>({
  key,
  defaultValue = {} as T,
}: UseUserPreferencesOptions) {
  const [preferences, setPreferences] = useState<T>(defaultValue as T);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadPreferences();
    }
  }, [userId, key]);

  const loadPreferences = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("preference_value")
        .eq("user_id", userId)
        .eq("preference_key", key)
        .maybeSingle();

      if (error) throw error;

      if (data?.preference_value) {
        setPreferences(data.preference_value as T);
      } else {
        setPreferences(defaultValue as T);
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
      setPreferences(defaultValue as T);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = useCallback(
    async (newPreferences: T) => {
      if (!userId) return;

      try {
        const { error } = await supabase
          .from("user_preferences")
          .upsert(
            {
              user_id: userId,
              preference_key: key,
              preference_value: newPreferences,
            },
            {
              onConflict: "user_id,preference_key",
            }
          );

        if (error) throw error;

        setPreferences(newPreferences);
      } catch (error) {
        console.error("Error saving preferences:", error);
      }
    },
    [userId, key]
  );

  const updatePreference = useCallback(
    async <K extends keyof T>(prefKey: K, value: T[K]) => {
      const newPreferences = { ...preferences, [prefKey]: value };
      await savePreferences(newPreferences);
    },
    [preferences, savePreferences]
  );

  return {
    preferences,
    loading,
    savePreferences,
    updatePreference,
    reload: loadPreferences,
  };
}
