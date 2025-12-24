import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Sparkly.hr default public color palette - Emotions style (soft lavender/cream)
export const DEFAULT_PUBLIC_COLORS: Record<string, string> = {
  "--background": "30 33% 96%",        // Soft warm cream (#f8f5f2)
  "--foreground": "250 20% 25%",       // Deep purple-gray text
  "--card": "0 0% 100%",               // Pure white cards
  "--card-foreground": "250 20% 25%",  // Deep purple-gray
  "--popover": "0 0% 100%",
  "--popover-foreground": "250 20% 25%",
  "--primary": "250 45% 58%",          // Soft lavender/purple (#7c6fae)
  "--primary-foreground": "0 0% 100%",
  "--secondary": "250 25% 94%",        // Light lavender tint
  "--secondary-foreground": "250 20% 30%",
  "--muted": "250 15% 92%",            // Subtle lavender muted
  "--muted-foreground": "250 15% 50%", // Muted purple-gray
  "--accent": "315 40% 65%",           // Rose/pink accent for highlights
  "--accent-foreground": "0 0% 100%",
  "--destructive": "0 72% 55%",
  "--destructive-foreground": "0 0% 100%",
  "--border": "250 15% 90%",           // Soft lavender border
  "--input": "250 15% 90%",
  "--ring": "250 45% 58%",
  "--quiz-primary": "250 45% 58%",     // Main lavender
  "--quiz-primary-light": "250 35% 70%", // Lighter lavender
  "--quiz-glow": "250 45% 75%",        // Glow effect
  "--sparkly-blush": "330 50% 95%",    // Soft pink blush
  "--sparkly-cream": "30 33% 96%",     // Warm cream background
  "--sparkly-indigo": "250 45% 58%",   // Lavender primary
  "--sparkly-indigo-light": "250 35% 70%",
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
