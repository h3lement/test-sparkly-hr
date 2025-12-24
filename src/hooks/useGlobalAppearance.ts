import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AppearanceColors {
  light: Record<string, string>;
  dark: Record<string, string>;
}

interface AppearancePreferences {
  themeMode: "light" | "dark" | "system";
  uiDensity: "compact" | "default" | "comfortable";
  headingFont: string;
  bodyFont: string;
  borderRadius: number;
  spacing: number;
  colors: AppearanceColors;
  activePreset?: string;
}

const DEFAULT_COLORS: AppearanceColors = {
  light: {
    "--background": "340 30% 97%",
    "--foreground": "230 25% 18%",
    "--card": "0 0% 100%",
    "--card-foreground": "230 25% 18%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "230 25% 18%",
    "--primary": "235 60% 52%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "340 25% 94%",
    "--secondary-foreground": "230 25% 25%",
    "--muted": "340 20% 92%",
    "--muted-foreground": "230 15% 45%",
    "--accent": "235 50% 58%",
    "--accent-foreground": "0 0% 100%",
    "--destructive": "0 84% 60%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "340 20% 88%",
    "--input": "340 20% 88%",
    "--ring": "235 60% 52%",
    "--quiz-primary": "235 60% 52%",
    "--quiz-primary-light": "235 50% 58%",
    "--quiz-glow": "235 60% 65%",
  },
  dark: {
    "--background": "230 25% 10%",
    "--foreground": "340 20% 95%",
    "--card": "230 25% 14%",
    "--card-foreground": "340 20% 95%",
    "--popover": "230 25% 14%",
    "--popover-foreground": "340 20% 95%",
    "--primary": "235 60% 60%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "230 25% 18%",
    "--secondary-foreground": "340 20% 90%",
    "--muted": "230 25% 20%",
    "--muted-foreground": "340 15% 60%",
    "--accent": "235 50% 65%",
    "--accent-foreground": "0 0% 100%",
    "--destructive": "0 62% 40%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "230 25% 22%",
    "--input": "230 25% 22%",
    "--ring": "235 60% 60%",
    "--quiz-primary": "235 60% 52%",
    "--quiz-primary-light": "235 50% 58%",
    "--quiz-glow": "235 60% 65%",
  },
};

const DEFAULT_PREFERENCES: AppearancePreferences = {
  // Enforce daylight mode across the entire app (admin + public)
  themeMode: "light",
  uiDensity: "default",
  headingFont: "'Playfair Display', serif",
  bodyFont: "'DM Sans', sans-serif",
  borderRadius: 0.75,
  spacing: 1,
  colors: DEFAULT_COLORS,
};

function applyAppearance(prefs: AppearancePreferences) {
  const root = document.documentElement;

  // Enforce daylight mode: never allow the "dark" class in the app UI.
  root.classList.remove("dark");

  // Apply UI density
  root.classList.remove("density-compact", "density-default", "density-comfortable");
  root.classList.add(`density-${prefs.uiDensity}`);

  // Apply fonts
  root.style.setProperty("--font-heading", prefs.headingFont);
  root.style.setProperty("--font-body", prefs.bodyFont);

  // Apply border radius
  root.style.setProperty("--radius", `${prefs.borderRadius}rem`);

  // Always apply light palette
  Object.entries(prefs.colors.light).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function useGlobalAppearance() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadAppearance = async () => {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Load user preferences from database
          const { data, error } = await supabase
            .from("user_preferences")
            .select("preference_value")
            .eq("user_id", user.id)
            .eq("preference_key", "appearance_settings")
            .maybeSingle();

          if (!error && data?.preference_value) {
            const prefs = {
              ...DEFAULT_PREFERENCES,
              ...(data.preference_value as Partial<AppearancePreferences>),
              colors: {
                light: {
                  ...DEFAULT_COLORS.light,
                  ...(data.preference_value as any)?.colors?.light,
                },
                dark: {
                  ...DEFAULT_COLORS.dark,
                  ...(data.preference_value as any)?.colors?.dark,
                },
              },
            };
            applyAppearance(prefs);
          } else {
            applyAppearance(DEFAULT_PREFERENCES);
          }
        } else {
          // No user - apply defaults
          applyAppearance(DEFAULT_PREFERENCES);
        }
      } catch (error) {
        console.error("Error loading appearance settings:", error);
        applyAppearance(DEFAULT_PREFERENCES);
      } finally {
        setLoaded(true);
      }
    };

    loadAppearance();

    // Hard lock: prevent any code from re-adding "dark" after we remove it.
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      if (root.classList.contains("dark")) root.classList.remove("dark");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    // Listen for auth state changes to reload appearance
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadAppearance();
    });

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => loadAppearance();
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      observer.disconnect();
      subscription.unsubscribe();
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return { loaded };
}
