import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Sparkly.hr default public color palette (daylight mode)
export const DEFAULT_PUBLIC_COLORS: Record<string, string> = {
  "--background": "20 40% 97%",
  "--foreground": "230 25% 15%",
  "--card": "0 0% 100%",
  "--card-foreground": "230 25% 15%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "230 25% 15%",
  "--primary": "235 55% 52%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "20 25% 93%",
  "--secondary-foreground": "230 25% 20%",
  "--muted": "20 20% 90%",
  "--muted-foreground": "230 15% 45%",
  "--accent": "235 45% 60%",
  "--accent-foreground": "0 0% 100%",
  "--destructive": "0 84% 60%",
  "--destructive-foreground": "0 0% 100%",
  "--border": "20 15% 88%",
  "--input": "20 15% 88%",
  "--ring": "235 55% 52%",
  "--quiz-primary": "235 55% 52%",
  "--quiz-primary-light": "235 45% 60%",
  "--quiz-glow": "235 55% 65%",
  "--sparkly-blush": "15 60% 95%",
  "--sparkly-cream": "40 30% 96%",
  "--sparkly-indigo": "235 55% 52%",
  "--sparkly-indigo-light": "235 45% 60%",
};

export interface PublicThemeSettings {
  preset: string;
  colors: Record<string, string>;
  headingFont: string;
  bodyFont: string;
  borderRadius: number;
}

const DEFAULT_PUBLIC_THEME: PublicThemeSettings = {
  preset: "sparkly",
  colors: DEFAULT_PUBLIC_COLORS,
  headingFont: "'Playfair Display', serif",
  bodyFont: "'DM Sans', sans-serif",
  borderRadius: 0.75,
};

/**
 * Apply public theme to the document root.
 * Enforces light mode and applies color palette from settings.
 */
export function applyPublicTheme(settings: PublicThemeSettings) {
  const root = document.documentElement;

  // Enforce light mode: no dark class allowed
  root.classList.remove("dark");

  // Apply fonts
  root.style.setProperty("--font-heading", settings.headingFont);
  root.style.setProperty("--font-body", settings.bodyFont);

  // Apply border radius
  root.style.setProperty("--radius", `${settings.borderRadius}rem`);

  // Apply all colors
  Object.entries(settings.colors).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

/**
 * Hook to fetch and apply public theme settings.
 * Used on public-facing pages (quizzes, all-quizzes list, etc.)
 */
export function usePublicTheme() {
  const [settings, setSettings] = useState<PublicThemeSettings>(DEFAULT_PUBLIC_THEME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchPublicTheme = async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("setting_value")
          .eq("setting_key", "public_theme")
          .maybeSingle();

        if (error) {
          console.error("Error loading public theme:", error);
        }

        if (isMounted) {
          if (data?.setting_value) {
            try {
              const parsed = JSON.parse(data.setting_value) as Partial<PublicThemeSettings>;
              const merged: PublicThemeSettings = {
                ...DEFAULT_PUBLIC_THEME,
                ...parsed,
                colors: {
                  ...DEFAULT_PUBLIC_COLORS,
                  ...(parsed.colors || {}),
                },
              };
              setSettings(merged);
              applyPublicTheme(merged);
            } catch {
              applyPublicTheme(DEFAULT_PUBLIC_THEME);
            }
          } else {
            applyPublicTheme(DEFAULT_PUBLIC_THEME);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load public theme:", err);
        if (isMounted) {
          applyPublicTheme(DEFAULT_PUBLIC_THEME);
          setLoading(false);
        }
      }
    };

    fetchPublicTheme();

    // Guard against any code re-adding "dark" class
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      if (root.classList.contains("dark")) root.classList.remove("dark");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      isMounted = false;
      observer.disconnect();
    };
  }, []);

  return { settings, loading };
}
