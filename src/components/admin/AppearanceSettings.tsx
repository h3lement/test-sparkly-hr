import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw, Save, Sun, Moon, Type } from "lucide-react";

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

const DEFAULT_TOKENS: ColorToken[] = [
  { key: "--background", label: "Background", lightValue: "340 30% 97%", darkValue: "230 25% 10%" },
  { key: "--foreground", label: "Foreground", lightValue: "230 25% 18%", darkValue: "340 20% 95%" },
  { key: "--card", label: "Card", lightValue: "0 0% 100%", darkValue: "230 25% 14%" },
  { key: "--card-foreground", label: "Card Foreground", lightValue: "230 25% 18%", darkValue: "340 20% 95%" },
  { key: "--popover", label: "Popover", lightValue: "0 0% 100%", darkValue: "230 25% 14%" },
  { key: "--popover-foreground", label: "Popover Foreground", lightValue: "230 25% 18%", darkValue: "340 20% 95%" },
  { key: "--primary", label: "Primary", lightValue: "235 60% 52%", darkValue: "235 60% 60%" },
  { key: "--primary-foreground", label: "Primary Foreground", lightValue: "0 0% 100%", darkValue: "0 0% 100%" },
  { key: "--secondary", label: "Secondary", lightValue: "340 25% 94%", darkValue: "230 25% 18%" },
  { key: "--secondary-foreground", label: "Secondary Foreground", lightValue: "230 25% 25%", darkValue: "340 20% 90%" },
  { key: "--muted", label: "Muted", lightValue: "340 20% 92%", darkValue: "230 25% 20%" },
  { key: "--muted-foreground", label: "Muted Foreground", lightValue: "230 15% 45%", darkValue: "340 15% 60%" },
  { key: "--accent", label: "Accent", lightValue: "235 50% 58%", darkValue: "235 50% 65%" },
  { key: "--accent-foreground", label: "Accent Foreground", lightValue: "0 0% 100%", darkValue: "0 0% 100%" },
  { key: "--destructive", label: "Destructive", lightValue: "0 84% 60%", darkValue: "0 62% 40%" },
  { key: "--destructive-foreground", label: "Destructive Foreground", lightValue: "0 0% 100%", darkValue: "0 0% 100%" },
  { key: "--border", label: "Border", lightValue: "340 20% 88%", darkValue: "230 25% 22%" },
  { key: "--input", label: "Input", lightValue: "340 20% 88%", darkValue: "230 25% 22%" },
  { key: "--ring", label: "Ring", lightValue: "235 60% 52%", darkValue: "235 60% 60%" },
];

const QUIZ_TOKENS: ColorToken[] = [
  { key: "--quiz-primary", label: "Quiz Primary", lightValue: "235 60% 52%", darkValue: "235 60% 52%" },
  { key: "--quiz-primary-light", label: "Quiz Primary Light", lightValue: "235 50% 58%", darkValue: "235 50% 58%" },
  { key: "--quiz-glow", label: "Quiz Glow", lightValue: "235 60% 65%", darkValue: "235 60% 65%" },
];

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
  token: ColorToken;
  mode: "light" | "dark";
  value: string;
  onChange: (key: string, mode: "light" | "dark", value: string) => void;
}

function ColorInput({ token, mode, value, onChange }: ColorInputProps) {
  const hexValue = hslToHex(value);

  return (
    <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
      <div
        className="w-10 h-10 rounded-md border border-border shrink-0"
        style={{ backgroundColor: `hsl(${value})` }}
      />
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{token.label}</Label>
        <p className="text-xs text-muted-foreground font-mono truncate">{token.key}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={hexValue}
          onChange={(e) => onChange(token.key, mode, hexToHsl(e.target.value))}
          className="w-10 h-10 p-1 cursor-pointer"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(token.key, mode, e.target.value)}
          className="w-32 font-mono text-xs"
          placeholder="H S% L%"
        />
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const [tokens, setTokens] = useState<ColorToken[]>([...DEFAULT_TOKENS, ...QUIZ_TOKENS]);
  const [headingFont, setHeadingFont] = useState("'Playfair Display', serif");
  const [bodyFont, setBodyFont] = useState("'DM Sans', sans-serif");
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const handleChange = (key: string, mode: "light" | "dark", value: string) => {
    setTokens(prev => prev.map(t => {
      if (t.key === key) {
        return mode === "light" 
          ? { ...t, lightValue: value }
          : { ...t, darkValue: value };
      }
      return t;
    }));
    setHasChanges(true);
    
    // Live preview
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    if ((mode === "dark" && isDark) || (mode === "light" && !isDark)) {
      root.style.setProperty(key, value);
    }
  };

  const handleFontChange = (type: "heading" | "body", value: string) => {
    if (type === "heading") {
      setHeadingFont(value);
      document.documentElement.style.setProperty("--font-heading", value);
    } else {
      setBodyFont(value);
      document.documentElement.style.setProperty("--font-body", value);
    }
    setHasChanges(true);
  };

  const handleReset = () => {
    setTokens([...DEFAULT_TOKENS, ...QUIZ_TOKENS]);
    setHeadingFont("'Playfair Display', serif");
    setBodyFont("'DM Sans', sans-serif");
    setHasChanges(false);
    
    // Reset CSS variables
    const root = document.documentElement;
    [...DEFAULT_TOKENS, ...QUIZ_TOKENS].forEach(token => {
      const isDark = root.classList.contains("dark");
      root.style.setProperty(token.key, isDark ? token.darkValue : token.lightValue);
    });
    root.style.setProperty("--font-heading", "'Playfair Display', serif");
    root.style.setProperty("--font-body", "'DM Sans', sans-serif");
    
    toast({
      title: "Reset complete",
      description: "All settings have been reset to defaults",
    });
  };

  const handleSave = () => {
    toast({
      title: "Changes saved",
      description: "Your appearance settings have been applied",
    });
    setHasChanges(false);
  };

  const coreTokens = tokens.filter(t => !t.key.includes("quiz"));
  const quizTokens = tokens.filter(t => t.key.includes("quiz"));

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appearance</h1>
          <p className="text-muted-foreground mt-1">Customize design tokens, fonts, and theme colors</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Typography Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Typography
          </CardTitle>
          <CardDescription>Choose fonts for headings and body text</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Heading Font</Label>
            <Select value={headingFont} onValueChange={(v) => handleFontChange("heading", v)}>
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
            <p className="text-2xl mt-3" style={{ fontFamily: headingFont }}>
              Preview Heading
            </p>
          </div>
          <div className="space-y-2">
            <Label>Body Font</Label>
            <Select value={bodyFont} onValueChange={(v) => handleFontChange("body", v)}>
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
            <p className="text-base mt-3" style={{ fontFamily: bodyFont }}>
              Preview body text for reading content.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="light" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="light" className="gap-2">
            <Sun className="h-4 w-4" />
            Light Mode
          </TabsTrigger>
          <TabsTrigger value="dark" className="gap-2">
            <Moon className="h-4 w-4" />
            Dark Mode
          </TabsTrigger>
        </TabsList>

        <TabsContent value="light" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Core Colors</CardTitle>
              <CardDescription>Main theme colors for light mode</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {coreTokens.map(token => (
                <ColorInput
                  key={token.key}
                  token={token}
                  mode="light"
                  value={token.lightValue}
                  onChange={handleChange}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quiz Colors</CardTitle>
              <CardDescription>Special colors for quiz components</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {quizTokens.map(token => (
                <ColorInput
                  key={token.key}
                  token={token}
                  mode="light"
                  value={token.lightValue}
                  onChange={handleChange}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dark" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Core Colors</CardTitle>
              <CardDescription>Main theme colors for dark mode</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {coreTokens.map(token => (
                <ColorInput
                  key={token.key}
                  token={token}
                  mode="dark"
                  value={token.darkValue}
                  onChange={handleChange}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quiz Colors</CardTitle>
              <CardDescription>Special colors for quiz components</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {quizTokens.map(token => (
                <ColorInput
                  key={token.key}
                  token={token}
                  mode="dark"
                  value={token.darkValue}
                  onChange={handleChange}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
