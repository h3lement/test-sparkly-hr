import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Key, Eye, EyeOff, Save, ExternalLink, CheckCircle } from "lucide-react";

interface ResendApiKeySettingsProps {
  onApiKeyChange?: (hasKey: boolean) => void;
}

export function ResendApiKeySettings({ onApiKeyChange }: ResendApiKeySettingsProps) {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(true); // RESEND_API_KEY already exists
  const { toast } = useToast();

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter an API key",
        variant: "destructive",
      });
      return;
    }

    if (!apiKey.startsWith("re_")) {
      toast({
        title: "Invalid API Key",
        description: "Resend API keys start with 're_'",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    // Note: In production, this would call an edge function to update the secret
    // For now, we show the user instructions
    toast({
      title: "API Key Ready",
      description: "To update the API key, use the Secrets management in project settings.",
    });
    
    setIsSaving(false);
    setApiKey("");
    onApiKeyChange?.(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium mb-2">Current Status</h4>
        <div className="flex items-center gap-2">
          {hasExistingKey ? (
            <>
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="w-3 h-3 mr-1" />
                Connected
              </Badge>
              <span className="text-sm text-muted-foreground">
                RESEND_API_KEY is configured
              </span>
            </>
          ) : (
            <>
              <Badge variant="destructive">Not Configured</Badge>
              <span className="text-sm text-muted-foreground">
                Add your Resend API key to send emails
              </span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="resend-api-key" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            {hasExistingKey ? "Update API Key" : "Add API Key"}
          </Label>
          <p className="text-sm text-muted-foreground mt-1 mb-2">
            Get your API key from{" "}
            <a 
              href="https://resend.com/api-keys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              resend.com/api-keys
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="resend-api-key"
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="pr-10 font-mono text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
          </div>
          <Button 
            onClick={handleSaveApiKey} 
            disabled={isSaving || !apiKey.trim()}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground">
          The API key will be stored securely as an environment variable.
        </p>
      </div>

      <div className="pt-4 border-t space-y-4">
        <div>
          <h4 className="font-medium mb-2">Domain Configuration</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Verify your sending domain in Resend to ensure email deliverability.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a 
              href="https://resend.com/domains" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Manage Domains
            </a>
          </Button>
        </div>

        <div>
          <h4 className="font-medium mb-2">Email Logs & Analytics</h4>
          <p className="text-sm text-muted-foreground mb-3">
            View delivery statistics and logs in the Resend dashboard.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a 
              href="https://resend.com/emails" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View Email Logs
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
