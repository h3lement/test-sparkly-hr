import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Key,
  ExternalLink,
  Loader2,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";

interface ApiKeyManagementCardProps {
  onApiKeyUpdated?: () => void;
}

export function ApiKeyManagementCard({ onApiKeyUpdated }: ApiKeyManagementCardProps) {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Check if there's an existing API key in the database
  useEffect(() => {
    const checkExistingKey = async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("id")
          .eq("setting_key", "RESEND_API_KEY")
          .maybeSingle();

        if (error) {
          console.error("Error checking for existing API key:", error);
        } else {
          setHasExistingKey(!!data);
        }
      } catch (error) {
        console.error("Error checking for existing API key:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingKey();
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter an API key",
        variant: "destructive",
      });
      return;
    }

    // Basic validation for Resend API key format
    if (!apiKey.startsWith("re_")) {
      toast({
        title: "Invalid API Key",
        description: "Resend API keys start with 're_'. Please check your key.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Check if key already exists
      const { data: existingKey } = await supabase
        .from("app_settings")
        .select("id")
        .eq("setting_key", "RESEND_API_KEY")
        .maybeSingle();

      if (existingKey) {
        // Update existing key
        const { error } = await supabase
          .from("app_settings")
          .update({ setting_value: apiKey.trim() })
          .eq("setting_key", "RESEND_API_KEY");

        if (error) throw error;
      } else {
        // Insert new key
        const { error } = await supabase
          .from("app_settings")
          .insert({
            setting_key: "RESEND_API_KEY",
            setting_value: apiKey.trim(),
          });

        if (error) throw error;
      }

      toast({
        title: "API Key Saved",
        description: "Your Resend API key has been saved successfully.",
      });

      setApiKey("");
      setHasExistingKey(true);
      onApiKeyUpdated?.();
    } catch (error: any) {
      console.error("Error saving API key:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save API key",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteApiKey = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .delete()
        .eq("setting_key", "RESEND_API_KEY");

      if (error) throw error;

      toast({
        title: "API Key Removed",
        description: "Your Resend API key has been removed. The system will fall back to the default configuration.",
      });

      setHasExistingKey(false);
      onApiKeyUpdated?.();
    } catch (error: any) {
      console.error("Error deleting API key:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove API key",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <Key className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-lg">API Key Management</CardTitle>
            <CardDescription>
              {hasExistingKey 
                ? "Update or remove your custom Resend API key"
                : "Add your Resend API key for email sending"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {hasExistingKey && (
              <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-700">
                  Custom API key is configured
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="api-key">
                {hasExistingKey ? "New API Key (to replace existing)" : "Resend API Key"}
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="api-key"
                    type={showApiKey ? "text" : "password"}
                    placeholder="re_xxxxxxxxxx..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <Button
                  onClick={handleSaveApiKey}
                  disabled={isSaving || !apiKey.trim()}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            </div>

            {hasExistingKey && (
              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteApiKey}
                  disabled={isSaving}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Remove Custom API Key
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Removing the custom key will fall back to the system default configuration.
                </p>
              </div>
            )}

            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground mb-3">
                To get your Resend API key:
              </p>
              <ol className="text-sm space-y-1.5 list-decimal list-inside text-muted-foreground mb-3">
                <li>Go to the Resend dashboard</li>
                <li>Navigate to API Keys</li>
                <li>Create a new key or copy an existing one</li>
                <li>Paste it above and click Save</li>
              </ol>
              <a
                href="https://resend.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Resend Dashboard
                </Button>
              </a>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
