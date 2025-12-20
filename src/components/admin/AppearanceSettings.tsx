import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { RotateCcw, Save, Sun, Moon, Monitor, Type, Palette, Box, Loader2 } from "lucide-react";

interface ColorToken {
  key: string;
  label: string;
  lightValue: string;
  darkValue: string;
}

interface FontOption {
  value: string;
  label: string;
  category: "serif" | "sans-serif" | "display" | "monospace";
}

interface AppearancePreferences {
  themeMode: "light" | "dark" | "system";
  headingFont: string;
  bodyFont: string;
  borderRadius: number;
  spacing: number;
  colors: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
}

const HEADING_FONTS: FontOption[] = [
  { value: "'Playfair Display', serif", label: "Playfair Display", category: "serif" },
  { value: "'Merriweather', serif", label: "Merriweather", category: "serif" },
  { value: "'Lora', serif", label: "Lora", category: "serif" },
  { value: "'Crimson Text', serif", label: "Crimson Text", category: "serif" },
  { value: "'Source Serif Pro', serif", label: "Source Serif Pro", category: "serif" },
  { value: "'Poppins', sans-serif", label: "Poppins", category: "sans-serif" },
  { value: "'Montserrat', sans-serif", label: "Montserrat", category: "sans-serif" },
  { value: "'Raleway', sans-serif", label: "Raleway", category: "sans-serif" },
  { value: "'Oswald', sans-serif", label: "Oswald", category: "display" },
  { value: "'Bebas Neue', sans-serif", label: "Bebas Neue", category: "display" },
];

const BODY_FONTS: FontOption[] = [
  { value: "'DM Sans', sans-serif", label: "DM Sans", category: "sans-serif" },
  { value: "'Inter', sans-serif", label: "Inter", category: "sans-serif" },
  { value: "'Roboto', sans-serif", label: "Roboto", category: "sans-serif" },
  { value: "'Open Sans', sans-serif", label: "Open Sans", category: "sans-serif" },
  { value: "'Lato', sans-serif", label: "Lato", category: "sans-serif" },
  { value: "'Nunito', sans-serif", label: "Nunito", category: "sans-serif" },
  { value: "'Source Sans Pro', sans-serif", label: "Source Sans Pro", category: "sans-serif" },
  { value: "'Work Sans', sans-serif", label: "Work Sans", category: "sans-serif" },
  { value: "'IBM Plex Sans', sans-serif", label: "IBM Plex Sans", category: "sans-serif" },
  { value: "'Fira Sans', sans-serif", label: "Fira Sans", category: "sans-serif" },
];

const DEFAULT_COLORS = {
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
  themeMode: "system",
  headingFont: "'Playfair Display', serif",
  bodyFont: "'DM Sans', sans-serif",
  borderRadius: 0.75,
  spacing: 1,
  colors: DEFAULT_COLORS,
};

const COLOR_GROUPS = {
  base: ["--background", "--foreground"],
  surfaces: ["--card", "--card-foreground", "--popover", "--popover-foreground"],
  brand: ["--primary", "--primary-foreground", "--secondary", "--secondary-foreground"],
  ui: ["--muted", "--muted-foreground", "--accent", "--accent-foreground"],
  feedback: ["--destructive", "--destructive-foreground"],
  borders: ["--border", "--input", "--ring"],
  quiz: ["--quiz-primary", "--quiz-primary-light", "--quiz-glow"],
};

const COLOR_LABELS: Record<string, string> = {
  "--background": "Background",
  "--foreground": "Foreground",
  "--card": "Card",
  "--card-foreground": "Card Text",
  "--popover": "Popover",
  "--popover-foreground": "Popover Text",
  "--primary": "Primary",
  "--primary-foreground": "Primary Text",
  "--secondary": "Secondary",
  "--secondary-foreground": "Secondary Text",
  "--muted": "Muted",
  "--muted-foreground": "Muted Text",
  "--accent": "Accent",
  "--accent-foreground": "Accent Text",
  "--destructive": "Destructive",
  "--destructive-foreground": "Destructive Text",
  "--border": "Border",
  "--input": "Input",
  "--ring": "Focus Ring",
  "--quiz-primary": "Quiz Primary",
  "--quiz-primary-light": "Quiz Light",
  "--quiz-glow": "Quiz Glow",
};

function hslToHex(hsl: string): string {
  const parts = hsl.trim().split(/\s+/);
  if (parts.length !== 3) return "#808080";
  
  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 0% 50%";

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

interface ColorInputProps {
  colorKey: string;
  value: string;
  onChange: (key: string, value: string) => void;
}

function ColorInput({ colorKey, value, onChange }: ColorInputProps) {
  const hexValue = hslToHex(value);
  const label = COLOR_LABELS[colorKey] || colorKey;

  return (
    <div className="flex items-center gap-3 p-2 bg-secondary/30 rounded-lg">
      <div
        className="w-8 h-8 rounded-md border border-border shrink-0"
        style={{ backgroundColor: `hsl(${value})` }}
      />
      <div className="flex-1 min-w-0">
        <Label className="text-xs font-medium">{label}</Label>
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="color"
          value={hexValue}
          onChange={(e) => onChange(colorKey, hexToHsl(e.target.value))}
          className="w-8 h-8 p-0.5 cursor-pointer"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(colorKey, e.target.value)}
          className="w-28 font-mono text-xs h-8"
          placeholder="H S% L%"
        />
      </div>
    </div>
  );
}

function ColorGroup({ 
  title, 
  keys, 
  colors, 
  onChange 
}: { 
  title: string; 
  keys: string[]; 
  colors: Record<string, string>; 
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
      <div className="grid gap-2">
        {keys.map(key => (
          <ColorInput
            key={key}
            colorKey={key}
            value={colors[key] || "0 0% 50%"}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const { preferences, loading, savePreferences } = useUserPreferences<AppearancePreferences>({
    key: "appearance_settings",
    defaultValue: DEFAULT_PREFERENCES,
  });

  const [localPrefs, setLocalPrefs] = useState<AppearancePreferences>(DEFAULT_PREFERENCES);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Load from database
  useEffect(() => {
    if (!loading && preferences) {
      const merged = {
        ...DEFAULT_PREFERENCES,
        ...preferences,
        colors: {
          light: { ...DEFAULT_COLORS.light, ...preferences.colors?.light },
          dark: { ...DEFAULT_COLORS.dark, ...preferences.colors?.dark },
        },
      };
      setLocalPrefs(merged);
      applyTheme(merged);
    }
  }, [loading, preferences]);

  const applyTheme = (prefs: AppearancePreferences) => {
    const root = document.documentElement;
    
    // Apply theme mode
    if (prefs.themeMode === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    } else {
      root.classList.toggle("dark", prefs.themeMode === "dark");
    }

    // Apply fonts
    root.style.setProperty("--font-heading", prefs.headingFont);
    root.style.setProperty("--font-body", prefs.bodyFont);

    // Apply border radius
    root.style.setProperty("--radius", `${prefs.borderRadius}rem`);

    // Apply colors based on current mode
    const isDark = root.classList.contains("dark");
    const colors = isDark ? prefs.colors.dark : prefs.colors.light;
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  };

  const updateLocalPref = <K extends keyof AppearancePreferences>(
    key: K, 
    value: AppearancePreferences[K]
  ) => {
    const updated = { ...localPrefs, [key]: value };
    setLocalPrefs(updated);
    setHasChanges(true);
    applyTheme(updated);
  };

  const updateColor = (mode: "light" | "dark", colorKey: string, value: string) => {
    const updated = {
      ...localPrefs,
      colors: {
        ...localPrefs.colors,
        [mode]: {
          ...localPrefs.colors[mode],
          [colorKey]: value,
        },
      },
    };
    setLocalPrefs(updated);
    setHasChanges(true);
    applyTheme(updated);
  };

  const handleReset = () => {
    setLocalPrefs(DEFAULT_PREFERENCES);
    setHasChanges(true);
    applyTheme(DEFAULT_PREFERENCES);
    toast({
      title: "Reset complete",
      description: "All settings reset to defaults. Click Save to persist.",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePreferences(localPrefs);
      setHasChanges(false);
      toast({
        title: "Settings saved",
        description: "Your appearance preferences have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appearance</h1>
          <p className="text-muted-foreground mt-1">Customize your admin panel theme and design</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges || saving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="general" className="gap-2">
            <Monitor className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="typography" className="gap-2">
            <Type className="h-4 w-4" />
            Typography
          </TabsTrigger>
          <TabsTrigger value="light-colors" className="gap-2">
            <Sun className="h-4 w-4" />
            Light Colors
          </TabsTrigger>
          <TabsTrigger value="dark-colors" className="gap-2">
            <Moon className="h-4 w-4" />
            Dark Colors
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme Mode
              </CardTitle>
              <CardDescription>Choose how the interface appears</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => updateLocalPref("themeMode", value as AppearancePreferences["themeMode"])}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      localPrefs.themeMode === value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${localPrefs.themeMode === value ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${localPrefs.themeMode === value ? "text-primary" : ""}`}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5" />
                Layout & Spacing
              </CardTitle>
              <CardDescription>Adjust border radius and spacing scale</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Border Radius</Label>
                  <span className="text-sm text-muted-foreground font-mono">{localPrefs.borderRadius}rem</span>
                </div>
                <Slider
                  value={[localPrefs.borderRadius]}
                  onValueChange={([v]) => updateLocalPref("borderRadius", v)}
                  min={0}
                  max={2}
                  step={0.125}
                  className="w-full"
                />
                <div className="flex gap-2">
                  {[0, 0.25, 0.5, 0.75, 1, 1.5, 2].map(v => (
                    <div
                      key={v}
                      className="w-12 h-12 bg-primary/20 border border-primary/30"
                      style={{ borderRadius: `${v}rem` }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Spacing Scale</Label>
                  <span className="text-sm text-muted-foreground font-mono">{localPrefs.spacing}x</span>
                </div>
                <Slider
                  value={[localPrefs.spacing]}
                  onValueChange={([v]) => updateLocalPref("spacing", v)}
                  min={0.75}
                  max={1.5}
                  step={0.05}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Multiplier for all spacing values (padding, margins, gaps)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Typography Tab */}
        <TabsContent value="typography" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Font Families</CardTitle>
              <CardDescription>Choose fonts for headings and body text</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <Label>Heading Font</Label>
                <Select 
                  value={localPrefs.headingFont} 
                  onValueChange={(v) => updateLocalPref("headingFont", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HEADING_FONTS.map(font => (
                      <SelectItem key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value }}>{font.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({font.category})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <p className="text-2xl" style={{ fontFamily: localPrefs.headingFont }}>
                    Preview Heading
                  </p>
                  <p className="text-lg mt-1" style={{ fontFamily: localPrefs.headingFont }}>
                    Subheading Text
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <Label>Body Font</Label>
                <Select 
                  value={localPrefs.bodyFont} 
                  onValueChange={(v) => updateLocalPref("bodyFont", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BODY_FONTS.map(font => (
                      <SelectItem key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value }}>{font.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({font.category})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <p className="text-base" style={{ fontFamily: localPrefs.bodyFont }}>
                    This is how body text will appear in your interface.
                  </p>
                  <p className="text-sm mt-2 text-muted-foreground" style={{ fontFamily: localPrefs.bodyFont }}>
                    Secondary text and descriptions use this font too.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Light Colors Tab */}
        <TabsContent value="light-colors" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Base Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <ColorGroup
                  title=""
                  keys={COLOR_GROUPS.base}
                  colors={localPrefs.colors.light}
                  onChange={(k, v) => updateColor("light", k, v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Surface Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <ColorGroup
                  title=""
                  keys={COLOR_GROUPS.surfaces}
                  colors={localPrefs.colors.light}
                  onChange={(k, v) => updateColor("light", k, v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Brand Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <ColorGroup
                  title=""
                  keys={COLOR_GROUPS.brand}
                  colors={localPrefs.colors.light}
                  onChange={(k, v) => updateColor("light", k, v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">UI Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <ColorGroup
                  title=""
                  keys={COLOR_GROUPS.ui}
                  colors={localPrefs.colors.light}
                  onChange={(k, v) => updateColor("light", k, v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Feedback & Borders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorGroup
                  title="Feedback"
                  keys={COLOR_GROUPS.feedback}
                  colors={localPrefs.colors.light}
                  onChange={(k, v) => updateColor("light", k, v)}
                />
                <ColorGroup
                  title="Borders & Inputs"
                  keys={COLOR_GROUPS.borders}
                  colors={localPrefs.colors.light}
                  onChange={(k, v) => updateColor("light", k, v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quiz Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <ColorGroup
                  title=""
                  keys={COLOR_GROUPS.quiz}
                  colors={localPrefs.colors.light}
                  onChange={(k, v) => updateColor("light", k, v)}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Dark Colors Tab */}
        <TabsContent value="dark-colors" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Base Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <ColorGroup
                  title=""
                  keys={COLOR_GROUPS.base}
                  colors={localPrefs.colors.dark}
                  onChange={(k, v) => updateColor("dark", k, v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Surface Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <ColorGroup
                  title=""
                  keys={COLOR_GROUPS.surfaces}
                  colors={localPrefs.colors.dark}
                  onChange={(k, v) => updateColor("dark", k, v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Brand Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <ColorGroup
                  title=""
                  keys={COLOR_GROUPS.brand}
                  colors={localPrefs.colors.dark}
                  onChange={(k, v) => updateColor("dark", k, v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">UI Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <ColorGroup
                  title=""
                  keys={COLOR_GROUPS.ui}
                  colors={localPrefs.colors.dark}
                  onChange={(k, v) => updateColor("dark", k, v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Feedback & Borders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorGroup
                  title="Feedback"
                  keys={COLOR_GROUPS.feedback}
                  colors={localPrefs.colors.dark}
                  onChange={(k, v) => updateColor("dark", k, v)}
                />
                <ColorGroup
                  title="Borders & Inputs"
                  keys={COLOR_GROUPS.borders}
                  colors={localPrefs.colors.dark}
                  onChange={(k, v) => updateColor("dark", k, v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quiz Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <ColorGroup
                  title=""
                  keys={COLOR_GROUPS.quiz}
                  colors={localPrefs.colors.dark}
                  onChange={(k, v) => updateColor("dark", k, v)}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
