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
import { RotateCcw, Save, Sun, Moon, Monitor, Type, Palette, Box, Loader2, Sparkles, Copy, Check, Maximize2, Minimize2, Square } from "lucide-react";

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
  uiDensity: "compact" | "default" | "comfortable";
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
  uiDensity: "default",
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

    // Apply UI density
    root.classList.remove("density-compact", "density-default", "density-comfortable");
    root.classList.add(`density-${prefs.uiDensity}`);

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
          <TabsTrigger value="quiz-design" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Quiz Design
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
                <Square className="h-5 w-5" />
                UI Density
              </CardTitle>
              <CardDescription>Choose how compact or spacious the interface should be</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: "compact", label: "Compact", icon: Minimize2, description: "Dense layout, smaller text" },
                  { value: "default", label: "Default", icon: Square, description: "Balanced spacing" },
                  { value: "comfortable", label: "Comfortable", icon: Maximize2, description: "Spacious, larger text" },
                ].map(({ value, label, icon: Icon, description }) => (
                  <button
                    key={value}
                    onClick={() => updateLocalPref("uiDensity", value as AppearancePreferences["uiDensity"])}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      localPrefs.uiDensity === value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${localPrefs.uiDensity === value ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${localPrefs.uiDensity === value ? "text-primary" : ""}`}>
                      {label}
                    </span>
                    <span className="text-xs text-muted-foreground text-center">{description}</span>
                  </button>
                ))}
              </div>

              {/* Live Preview */}
              <div className="space-y-3">
                <Label className="text-muted-foreground">Live Preview</Label>
                <div className="border border-border rounded-lg overflow-hidden bg-card">
                  {/* Preview Header */}
                  <div 
                    className="border-b border-border bg-secondary/30 flex items-center justify-between"
                    style={{ padding: "var(--density-padding)" }}
                  >
                    <span className="font-medium">Sample Card Header</span>
                    <div className="flex items-center" style={{ gap: "var(--density-gap)" }}>
                      <div className="h-6 w-6 rounded bg-primary/20" />
                      <div className="h-6 w-6 rounded bg-primary/20" />
                    </div>
                  </div>
                  {/* Preview Content */}
                  <div style={{ padding: "var(--density-padding)" }}>
                    <div className="space-y-2" style={{ gap: "var(--density-gap)" }}>
                      <p className="text-muted-foreground">This is how content spacing will look with your selected density.</p>
                      <div className="flex flex-wrap" style={{ gap: "var(--density-gap)" }}>
                        <button 
                          className="bg-primary text-primary-foreground rounded font-medium"
                          style={{ padding: "var(--density-padding-sm) var(--density-padding)" }}
                        >
                          Button
                        </button>
                        <button 
                          className="border border-border rounded font-medium"
                          style={{ padding: "var(--density-padding-sm) var(--density-padding)" }}
                        >
                          Secondary
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Preview Table Row */}
                  <div className="border-t border-border">
                    <div 
                      className="flex items-center justify-between border-b border-border/50 last:border-0"
                      style={{ padding: "var(--density-padding-sm) var(--density-padding)" }}
                    >
                      <span>Table Row Item</span>
                      <span className="text-muted-foreground text-sm">Value</span>
                    </div>
                    <div 
                      className="flex items-center justify-between border-b border-border/50 last:border-0"
                      style={{ padding: "var(--density-padding-sm) var(--density-padding)" }}
                    >
                      <span>Another Row</span>
                      <span className="text-muted-foreground text-sm">Data</span>
                    </div>
                  </div>
                </div>
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

        {/* Quiz Design Reference Tab */}
        <TabsContent value="quiz-design" className="space-y-6">
          <QuizDesignReference />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Quiz Design Reference Component
function QuizDesignReference() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const DesignToken = ({ label, value, cssVar }: { label: string; value: string; cssVar?: string }) => (
    <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {cssVar && <p className="text-xs text-muted-foreground font-mono">{cssVar}</p>}
      </div>
      <button
        onClick={() => copyToClipboard(value, label)}
        className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-md hover:bg-secondary transition-colors"
      >
        <code className="text-xs font-mono">{value}</code>
        {copiedKey === label ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    </div>
  );

  const ComponentPreview = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
    <div className={className}>
      <h4 className="text-sm font-medium text-muted-foreground mb-2">{title}</h4>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quiz Layout Structure</CardTitle>
          <CardDescription>Core layout values used across all quiz screens</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <DesignToken label="Container Max Width" value="max-w-2xl" cssVar="max-width: 42rem" />
          <DesignToken label="Content Max Width (Welcome)" value="max-w-xl" cssVar="max-width: 36rem" />
          <DesignToken label="Outer Padding (Desktop)" value="p-4 md:p-8" cssVar="padding: 1rem / 2rem" />
          <DesignToken label="Section Spacing" value="mb-8" cssVar="margin-bottom: 2rem" />
          <DesignToken label="Card Padding" value="p-6 / p-8" cssVar="padding: 1.5rem / 2rem" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Typography Scale</CardTitle>
          <CardDescription>Font sizes and styles for quiz text elements</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <DesignToken label="Main Heading (H1)" value="text-4xl md:text-5xl font-medium" cssVar="font-heading" />
          <DesignToken label="Section Heading (H2)" value="text-xl font-semibold" cssVar="font-heading" />
          <DesignToken label="Question Text" value="text-2xl md:text-3xl font-semibold" cssVar="font-heading" />
          <DesignToken label="Body Text" value="text-lg md:text-xl" cssVar="font-body" />
          <DesignToken label="Small Text" value="text-sm" cssVar="14px" />
          <DesignToken label="Micro Text" value="text-xs" cssVar="12px" />
          <DesignToken label="Heading Line Height" value="leading-tight" cssVar="line-height: 1.25" />
          <DesignToken label="Body Line Height" value="leading-relaxed" cssVar="line-height: 1.625" />
          <DesignToken label="Letter Spacing (Headings)" value="tracking-tight" cssVar="letter-spacing: -0.025em" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Component Styles</CardTitle>
          <CardDescription>Reusable component class patterns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ComponentPreview title="Badge Pill">
            <div className="badge-pill inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Assessment</span>
            </div>
            <code className="block mt-2 text-xs font-mono text-muted-foreground">className="badge-pill"</code>
          </ComponentPreview>

          <ComponentPreview title="Glass Card">
            <div className="glass rounded-xl p-6">
              <p className="text-sm">Glass morphism container with subtle background and border.</p>
            </div>
            <code className="block mt-2 text-xs font-mono text-muted-foreground">className="glass rounded-xl p-6"</code>
          </ComponentPreview>

          <ComponentPreview title="Primary CTA Button">
            <button className="bg-primary text-primary-foreground px-8 py-3 text-base font-semibold rounded-lg glow-primary hover:bg-primary/90 transition-all">
              Start Assessment
            </button>
            <code className="block mt-2 text-xs font-mono text-muted-foreground">className="bg-primary text-primary-foreground px-8 py-6 text-base font-semibold rounded-lg glow-primary"</code>
          </ComponentPreview>

          <ComponentPreview title="Gradient Text">
            <span className="font-heading text-3xl italic gradient-text">Highlighted Text</span>
            <code className="block mt-2 text-xs font-mono text-muted-foreground">className="gradient-text"</code>
          </ComponentPreview>

          <ComponentPreview title="Progress Bar">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full gradient-primary transition-all duration-500 ease-out" style={{ width: '65%' }} />
            </div>
            <code className="block mt-2 text-xs font-mono text-muted-foreground">className="h-2 bg-secondary rounded-full" → inner: "gradient-primary"</code>
          </ComponentPreview>

          <ComponentPreview title="Answer Option (Default)">
            <div className="w-full text-left p-5 rounded-xl border-2 border-border bg-card hover:border-primary/50 hover:bg-secondary/50 transition-all">
              <div className="flex items-center gap-4">
                <kbd className="flex w-6 h-6 rounded border text-xs font-mono items-center justify-center border-muted-foreground/50 bg-muted/50 text-muted-foreground">1</kbd>
                <span className="text-base">Answer option text</span>
              </div>
            </div>
            <code className="block mt-2 text-xs font-mono text-muted-foreground">className="p-5 rounded-xl border-2 border-border bg-card"</code>
          </ComponentPreview>

          <ComponentPreview title="Answer Option (Selected)">
            <div className="w-full text-left p-5 rounded-xl border-2 border-primary bg-primary/5 shadow-lg transition-all">
              <div className="flex items-center gap-4">
                <kbd className="flex w-6 h-6 rounded border text-xs font-mono items-center justify-center border-primary bg-primary text-primary-foreground">1</kbd>
                <span className="text-base">Selected answer option</span>
              </div>
            </div>
            <code className="block mt-2 text-xs font-mono text-muted-foreground">className="border-primary bg-primary/5 shadow-lg"</code>
          </ComponentPreview>

          <ComponentPreview title="Checkmark Circle">
            <span className="bg-primary w-5 h-5 rounded-full flex items-center justify-center text-primary-foreground text-xs">✓</span>
            <code className="block mt-2 text-xs font-mono text-muted-foreground">className="bg-primary w-5 h-5 rounded-full flex items-center justify-center text-primary-foreground text-xs"</code>
          </ComponentPreview>

          <ComponentPreview title="Numbered Circle (Results)">
            <span className="gradient-primary w-6 h-6 rounded-full flex items-center justify-center text-primary-foreground text-sm">1</span>
            <code className="block mt-2 text-xs font-mono text-muted-foreground">className="gradient-primary w-6 h-6 rounded-full flex items-center justify-center text-primary-foreground"</code>
          </ComponentPreview>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Animation Classes</CardTitle>
          <CardDescription>Motion and transition classes used in quiz flow</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <DesignToken label="Fade In (Screens)" value="animate-fade-in" cssVar="0.5s ease-out" />
          <DesignToken label="Slide Left (Questions)" value="animate-slide-in-left" cssVar="0.35s ease-out" />
          <DesignToken label="Slide Right (Back)" value="animate-slide-in-right" cssVar="0.35s ease-out" />
          <DesignToken label="Progress Bar" value="transition-all duration-500 ease-out" />
          <DesignToken label="Button Hover Scale" value="hover:scale-105 transition-transform" />
          <DesignToken label="Glow Pulse" value="glow-primary" cssVar="box-shadow pulse" />
          <DesignToken label="Color Transition" value="transition-colors" cssVar="150ms" />
          <DesignToken label="All Transitions" value="transition-all duration-200" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color Usage Patterns</CardTitle>
          <CardDescription>How semantic colors are applied in quiz components</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <DesignToken label="Background" value="bg-background" cssVar="--background" />
          <DesignToken label="Text Primary" value="text-foreground" cssVar="--foreground" />
          <DesignToken label="Text Secondary" value="text-muted-foreground" cssVar="--muted-foreground" />
          <DesignToken label="Card Background" value="bg-card" cssVar="--card" />
          <DesignToken label="Border Default" value="border-border" cssVar="--border" />
          <DesignToken label="Border Active" value="border-primary" cssVar="--primary" />
          <DesignToken label="Primary Button BG" value="bg-primary text-primary-foreground" />
          <DesignToken label="Secondary BG" value="bg-secondary" cssVar="--secondary" />
          <DesignToken label="Hover State" value="hover:bg-secondary/50" />
          <DesignToken label="Active Selection BG" value="bg-primary/5" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spacing Reference</CardTitle>
          <CardDescription>Common spacing values used throughout the quiz</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <DesignToken label="Gap XS" value="gap-2" cssVar="0.5rem" />
          <DesignToken label="Gap SM" value="gap-3" cssVar="0.75rem" />
          <DesignToken label="Gap MD" value="gap-4" cssVar="1rem" />
          <DesignToken label="Gap LG" value="gap-6" cssVar="1.5rem" />
          <DesignToken label="Margin Bottom SM" value="mb-4" cssVar="1rem" />
          <DesignToken label="Margin Bottom MD" value="mb-6" cssVar="1.5rem" />
          <DesignToken label="Margin Bottom LG" value="mb-8" cssVar="2rem" />
          <DesignToken label="Margin Bottom XL" value="mb-10" cssVar="2.5rem" />
          <DesignToken label="Padding SM" value="p-4" cssVar="1rem" />
          <DesignToken label="Padding MD" value="p-6" cssVar="1.5rem" />
          <DesignToken label="Padding LG" value="p-8" cssVar="2rem" />
          <DesignToken label="Padding X Button" value="px-8 py-6" cssVar="2rem / 1.5rem" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Border Radius Values</CardTitle>
          <CardDescription>Rounded corner presets</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <DesignToken label="Small" value="rounded-md" cssVar="calc(var(--radius) - 2px)" />
          <DesignToken label="Default" value="rounded-lg" cssVar="var(--radius)" />
          <DesignToken label="Large" value="rounded-xl" cssVar="0.75rem" />
          <DesignToken label="Extra Large" value="rounded-2xl" cssVar="1rem" />
          <DesignToken label="Full (Pills)" value="rounded-full" cssVar="9999px" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Result Level Gradients</CardTitle>
          <CardDescription>Color gradients used for different score ranges</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-16 h-8 rounded-md bg-gradient-to-r from-emerald-500 to-green-600" />
            <code className="text-xs font-mono">from-emerald-500 to-green-600</code>
            <span className="text-sm text-muted-foreground">High Score</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-16 h-8 rounded-md bg-gradient-to-r from-amber-500 to-orange-600" />
            <code className="text-xs font-mono">from-amber-500 to-orange-600</code>
            <span className="text-sm text-muted-foreground">Medium Score</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-16 h-8 rounded-md bg-gradient-to-r from-rose-500 to-red-600" />
            <code className="text-xs font-mono">from-rose-500 to-red-600</code>
            <span className="text-sm text-muted-foreground">Low Score</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-16 h-8 rounded-md bg-gradient-to-r from-red-600 to-rose-700" />
            <code className="text-xs font-mono">from-red-600 to-rose-700</code>
            <span className="text-sm text-muted-foreground">Critical</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
