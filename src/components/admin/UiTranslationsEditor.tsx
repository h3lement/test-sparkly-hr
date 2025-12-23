import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Save, Plus, RefreshCw, Search, Globe } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

interface UiTranslation {
  id: string;
  translation_key: string;
  translations: Record<string, string>;
  created_at: string;
  updated_at: string;
}

interface UiTranslationsEditorProps {
  quizId: string;
  displayLanguage: string;
}

// UI Translation keys that can be managed
const UI_TEXT_KEYS = [
  'startButton',
  'discoverTitle',
  'duration',
  'selectLanguage',
  'questionOf',
  'complete',
  'back',
  'next',
  'seeResults',
  'resultsReady',
  'resultsReadyHighlight',
  'emailDescription',
  'emailPlaceholder',
  'getResults',
  'sending',
  'privacyNotice',
  'invalidEmail',
  'emailError',
  'emailSuccess',
  'emailSuccessDesc',
  'somethingWrong',
  'resultsFor',
  'outOf',
  'points',
  'whatThisMeans',
  'keyInsights',
  'wantToImprove',
  'wantToImproveDesc',
  'ctaAdvice',
  'visitSparkly',
  'takeQuizAgain',
  'hypothesisTakeAgain',
  'keyboardHint',
  'finalQuestion',
  'openMindedness_hint',
  'leadershipOpenMindedness',
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'et', label: 'Estonian' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'it', label: 'Italian' },
  { code: 'es', label: 'Spanish' },
  { code: 'pl', label: 'Polish' },
  { code: 'ro', label: 'Romanian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'el', label: 'Greek' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'cs', label: 'Czech' },
  { code: 'hu', label: 'Hungarian' },
  { code: 'sv', label: 'Swedish' },
  { code: 'bg', label: 'Bulgarian' },
  { code: 'da', label: 'Danish' },
  { code: 'fi', label: 'Finnish' },
  { code: 'sk', label: 'Slovak' },
  { code: 'hr', label: 'Croatian' },
  { code: 'lt', label: 'Lithuanian' },
  { code: 'sl', label: 'Slovenian' },
  { code: 'lv', label: 'Latvian' },
  { code: 'ga', label: 'Irish' },
  { code: 'mt', label: 'Maltese' },
];

export function UiTranslationsEditor({ quizId, displayLanguage }: UiTranslationsEditorProps) {
  const [translations, setTranslations] = useState<UiTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editedTranslations, setEditedTranslations] = useState<Record<string, Record<string, string>>>({});
  const { toast } = useToast();

  const fetchTranslations = useCallback(async () => {
    if (!quizId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ui_translations')
        .select('*')
        .eq('quiz_id', quizId)
        .order('translation_key');

      if (error) throw error;
      
      // Cast JSON to proper type
      const typedData: UiTranslation[] = (data || []).map((item) => ({
        ...item,
        translations: (item.translations as Record<string, string>) || {},
      }));
      
      setTranslations(typedData);
      
      // Initialize edited state
      const editMap: Record<string, Record<string, string>> = {};
      typedData.forEach((t) => {
        editMap[t.id] = { ...t.translations };
      });
      setEditedTranslations(editMap);
    } catch (error: any) {
      console.error('Error fetching translations:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch UI translations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [quizId, toast]);

  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  const handleTranslationChange = (id: string, langCode: string, value: string) => {
    setEditedTranslations((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [langCode]: value,
      },
    }));
  };

  const saveTranslation = async (translation: UiTranslation) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('ui_translations')
        .update({ translations: editedTranslations[translation.id] })
        .eq('id', translation.id);

      if (error) throw error;

      toast({
        title: 'Saved',
        description: `"${translation.translation_key}" updated`,
      });
      
      fetchTranslations();
    } catch (error: any) {
      console.error('Error saving translation:', error);
      toast({
        title: 'Error',
        description: 'Failed to save translation',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteTranslation = async (translation: UiTranslation) => {
    try {
      const { error } = await supabase
        .from('ui_translations')
        .delete()
        .eq('id', translation.id);

      if (error) throw error;

      toast({
        title: 'Deleted',
        description: `"${translation.translation_key}" removed`,
      });
      
      fetchTranslations();
    } catch (error: any) {
      console.error('Error deleting translation:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete translation',
        variant: 'destructive',
      });
    }
  };

  const addTranslation = async (key: string) => {
    try {
      const { error } = await supabase
        .from('ui_translations')
        .insert({
          quiz_id: quizId,
          translation_key: key,
          translations: {},
        });

      if (error) throw error;

      toast({
        title: 'Added',
        description: `"${key}" translation added`,
      });
      
      fetchTranslations();
    } catch (error: any) {
      console.error('Error adding translation:', error);
      toast({
        title: 'Error',
        description: 'Failed to add translation',
        variant: 'destructive',
      });
    }
  };

  const filteredTranslations = translations.filter((t) =>
    t.translation_key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get available keys that are not yet added
  const existingKeys = new Set(translations.map((t) => t.translation_key));
  const availableKeys = UI_TEXT_KEYS.filter((k) => !existingKeys.has(k));

  // Get languages that have translations for this quiz
  const usedLanguages = new Set<string>();
  translations.forEach((t) => {
    Object.keys(t.translations || {}).forEach((lang) => {
      if (t.translations[lang]) usedLanguages.add(lang);
    });
  });
  const activeLanguages = LANGUAGES.filter(
    (l) => usedLanguages.has(l.code) || l.code === 'en' || l.code === displayLanguage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">UI Translations</h3>
          <Badge variant="outline">{translations.length} keys</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search keys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 w-48"
            />
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTranslations}
            className="h-8"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Info text */}
      <p className="text-sm text-muted-foreground">
        Manage UI text translations for this quiz. These override the default hardcoded translations.
        Use "AI Translate" with "Include static UI text" enabled to auto-generate these translations.
      </p>

      {translations.length === 0 ? (
        <div className="text-center py-8 border rounded-lg border-dashed">
          <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-4">
            No UI translations configured yet.
          </p>
          <p className="text-xs text-muted-foreground">
            Use "AI Translate" with "Include static UI text" to generate translations,
            or add them manually below.
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[400px] border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Key</TableHead>
                {activeLanguages.map((lang) => (
                  <TableHead key={lang.code} className="min-w-[150px]">
                    {lang.label}
                  </TableHead>
                ))}
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTranslations.map((translation) => (
                <TableRow key={translation.id}>
                  <TableCell className="font-mono text-xs">
                    {translation.translation_key}
                  </TableCell>
                  {activeLanguages.map((lang) => (
                    <TableCell key={lang.code}>
                      <Input
                        value={editedTranslations[translation.id]?.[lang.code] || ''}
                        onChange={(e) =>
                          handleTranslationChange(translation.id, lang.code, e.target.value)
                        }
                        placeholder={`${lang.label}...`}
                        className="h-7 text-xs"
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => saveTranslation(translation)}
                        disabled={saving}
                        className="h-7 w-7 p-0"
                        title="Save"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Translation</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{translation.translation_key}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTranslation(translation)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}

      {/* Add new translation */}
      {availableKeys.length > 0 && (
        <div className="border-t pt-4">
          <Label className="text-xs text-muted-foreground mb-2 block">
            Add missing translation key:
          </Label>
          <div className="flex flex-wrap gap-2">
            {availableKeys.slice(0, 10).map((key) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => addTranslation(key)}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3 h-3" />
                {key}
              </Button>
            ))}
            {availableKeys.length > 10 && (
              <span className="text-xs text-muted-foreground self-center">
                +{availableKeys.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
