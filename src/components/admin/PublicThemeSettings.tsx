import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw, Save, Globe, Loader2, Eye, Palette } from "lucide-react";
import { DEFAULT_PUBLIC_COLORS, applyPublicTheme, type PublicThemeSettings } from "@/hooks/usePublicTheme";

const HEADING_FONTS = [
  { value: "'Playfair Display', serif", label: "Playfair Display" },
  { value: "'Merriweather', serif", label: "Merriweather" },
  { value: "'Lora', serif", label: "Lora" },
  { value: "'Poppins', sans-serif", label: "Poppins" },
  { value: "'Montserrat', sans-serif", label: "Montserrat" },
];

const BODY_FONTS = [
  { value: "'DM Sans', sans-serif", label: "DM Sans" },
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "'Roboto', sans-serif", label: "Roboto" },
  { value: "'Open Sans', sans-serif", label: "Open Sans" },
  { value: "'Lato', sans-serif", label: "Lato" },
];

const COLOR_LABELS: Record<string, string> = {
  "--background": "Background",
  "--foreground": "Foreground",
  "--card": "Card",
  "--card-foreground": "Card Text",
  "--primary": "Primary",
  "--primary-foreground": "Primary Text",
  "--secondary": "Secondary",
  "--secondary-foreground": "Secondary Text",
  "--muted": "Muted",
  "--muted-foreground": "Muted Text",
  "--accent": "Accent",
  "--accent-foreground": "Accent Text",
  "--border": "Border",
  "--quiz-primary": "Quiz Primary",
  "--quiz-glow": "Quiz Glow",
};

const ESSENTIAL_COLORS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--quiz-primary",
  "--quiz-glow",
];

const DEFAULT_THEME: PublicThemeSettings = {
  preset: "sparkly",
  colors: DEFAULT_PUBLIC_COLORS,
  headingFont: "'Playfair Display', serif",
  bodyFont: "'DM Sans', sans-serif",
  borderRadius: 0.75,
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
    <div className="flex items-center gap-2 p-1.5 bg-secondary/30 rounded">
      <div
        className="w-5 h-5 rounded border border-border shrink-0"
        style={{ backgroundColor: `hsl(${value})` }}
      />
      <span className="text-[10px] font-medium flex-1 truncate">{label}</span>
      <Input
        type="color"
        value={hexValue}
        onChange={(e) => onChange(colorKey, hexToHsl(e.target.value))}
        className="w-6 h-6 p-0 cursor-pointer"
      />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(colorKey, e.target.value)}
        className="w-20 font-mono text-[10px] h-6 px-1"
        placeholder="H S% L%"
      />
    </div>
  );
}

export function PublicThemeSettings() {
  const [localSettings, setLocalSettings] = useState<PublicThemeSettings>(DEFAULT_THEME);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "public_theme")
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value) {
        try {
          const parsed = JSON.parse(data.setting_value) as Partial<PublicThemeSettings>;
          const merged: PublicThemeSettings = {
            ...DEFAULT_THEME,
            ...parsed,
            colors: {
              ...DEFAULT_PUBLIC_COLORS,
              ...(parsed.colors || {}),
            },
          };
          setLocalSettings(merged);
        } catch {
          setLocalSettings(DEFAULT_THEME);
        }
      } else {
        setLocalSettings(DEFAULT_THEME);
      }
    } catch (error) {
      console.error("Error loading public theme:", error);
      setLocalSettings(DEFAULT_THEME);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = <K extends keyof PublicThemeSettings>(key: K, value: PublicThemeSettings[K]) => {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    setHasChanges(true);
    // Live preview
    applyPublicTheme(updated);
  };

  const updateColor = (colorKey: string, value: string) => {
    const updated = {
      ...localSettings,
      colors: {
        ...localSettings.colors,
        [colorKey]: value,
      },
    };
    setLocalSettings(updated);
    setHasChanges(true);
    applyPublicTheme(updated);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_THEME);
    setHasChanges(true);
    applyPublicTheme(DEFAULT_THEME);
    toast({
      title: "Reset complete",
      description: "Public theme reset to Sparkly.hr defaults. Click Save to persist.",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          setting_key: "public_theme",
          setting_value: JSON.stringify(localSettings),
          updated_at: new Date().toISOString(),
        }, { onConflict: "setting_key" });

      if (error) throw error;

      setHasChanges(false);
      toast({
        title: "Public theme saved",
        description: "The public site will now use this color scheme.",
      });
    } catch (error) {
      console.error("Error saving public theme:", error);
      toast({
        title: "Error",
        description: "Failed to save public theme. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openPreview = () => {
    window.open("/", "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <CardTitle className="text-base">Public Website Theme</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={openPreview}>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Preview
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reset
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Save
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs mt-1">
            Color scheme for all public-facing pages (quizzes, quiz list, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Typography + Border Radius */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Heading Font</Label>
              <Select 
                value={localSettings.headingFont} 
                onValueChange={(v) => updateSetting("headingFont", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEADING_FONTS.map(font => (
                    <SelectItem key={font.value} value={font.value} className="text-xs">
                      <span style={{ fontFamily: font.value }}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Body Font</Label>
              <Select 
                value={localSettings.bodyFont} 
                onValueChange={(v) => updateSetting("bodyFont", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BODY_FONTS.map(font => (
                    <SelectItem key={font.value} value={font.value} className="text-xs">
                      <span style={{ fontFamily: font.value }}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Border Radius</Label>
                <span className="text-xs text-muted-foreground font-mono">{localSettings.borderRadius}rem</span>
              </div>
              <Slider
                value={[localSettings.borderRadius]}
                onValueChange={([v]) => updateSetting("borderRadius", v)}
                min={0}
                max={2}
                step={0.125}
                className="w-full"
              />
            </div>
          </div>

          {/* Row 2: Color Palette */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium">Color Palette</Label>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {ESSENTIAL_COLORS.map(colorKey => (
                <ColorInput
                  key={colorKey}
                  colorKey={colorKey}
                  value={localSettings.colors[colorKey] || DEFAULT_PUBLIC_COLORS[colorKey] || "0 0% 50%"}
                  onChange={updateColor}
                />
              ))}
            </div>
          </div>

          {/* Live Preview - Compact */}
          <div className="p-3 rounded-lg border" style={{ 
            backgroundColor: `hsl(${localSettings.colors["--background"]})`,
            color: `hsl(${localSettings.colors["--foreground"]})`,
            borderRadius: `${localSettings.borderRadius}rem`,
          }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold" style={{ fontFamily: localSettings.headingFont }}>
                  Preview Title
                </h3>
                <p className="text-xs" style={{ 
                  fontFamily: localSettings.bodyFont,
                  color: `hsl(${localSettings.colors["--muted-foreground"]})`,
                }}>
                  Public quiz preview
                </p>
              </div>
              <button
                className="px-3 py-1.5 rounded text-xs font-medium"
                style={{ 
                  backgroundColor: `hsl(${localSettings.colors["--primary"]})`,
                  color: `hsl(${localSettings.colors["--primary-foreground"]})`,
                  borderRadius: `${localSettings.borderRadius}rem`,
                }}
              >
                Start Quiz
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
