import { useState } from "react";
import { Euro, ChevronDown, Cpu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const AI_MODELS = [
  { 
    id: "google/gemini-2.5-flash", 
    label: "Gemini 2.5 Flash", 
    shortLabel: "Flash",
    description: "Fast & balanced (default)", 
    tier: "recommended" 
  },
  { 
    id: "google/gemini-2.5-flash-lite", 
    label: "Gemini 2.5 Flash Lite", 
    shortLabel: "Lite",
    description: "Fastest, cheapest", 
    tier: "economy" 
  },
  { 
    id: "google/gemini-2.5-pro", 
    label: "Gemini 2.5 Pro", 
    shortLabel: "Pro",
    description: "Best quality, slower", 
    tier: "premium" 
  },
  { 
    id: "openai/gpt-5-mini", 
    label: "GPT-5 Mini", 
    shortLabel: "GPT-5m",
    description: "Strong reasoning", 
    tier: "premium" 
  },
  { 
    id: "openai/gpt-5", 
    label: "GPT-5", 
    shortLabel: "GPT-5",
    description: "Most powerful", 
    tier: "premium" 
  },
] as const;

export type AiModelId = typeof AI_MODELS[number]["id"];

interface AiModelSelectorProps {
  totalCost: number;
  selectedModel: AiModelId;
  onModelChange: (model: AiModelId) => void;
  disabled?: boolean;
}

export function AiModelSelector({ 
  totalCost, 
  selectedModel, 
  onModelChange,
  disabled = false
}: AiModelSelectorProps) {
  const currentModel = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[0];
  
  const getTierColor = (tier: string) => {
    switch (tier) {
      case "economy": return "text-green-500";
      case "recommended": return "text-blue-500";
      case "premium": return "text-amber-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Cost display */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 text-primary text-xs">
        <Euro className="w-3.5 h-3.5" />
        <span className="font-medium">{totalCost.toFixed(4)}</span>
        <span className="text-muted-foreground">AI cost</span>
      </div>
      
      {/* Model selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1.5 h-7 text-xs"
            disabled={disabled}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{currentModel.shortLabel}</span>
            <ChevronDown className="w-3 h-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Select AI Model
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {AI_MODELS.map((model) => (
            <DropdownMenuItem
              key={model.id}
              onClick={() => onModelChange(model.id)}
              className={cn(
                "flex flex-col items-start gap-0.5 cursor-pointer",
                selectedModel === model.id && "bg-accent"
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium">{model.label}</span>
                {selectedModel === model.id && (
                  <span className="ml-auto text-primary">✓</span>
                )}
              </div>
              <span className={cn("text-xs", getTierColor(model.tier))}>
                {model.description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
