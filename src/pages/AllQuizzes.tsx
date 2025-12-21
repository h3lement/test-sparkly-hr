import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/quiz/Footer";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface Quiz {
  id: string;
  slug: string;
  title: Json;
  description: Json;
  quiz_type: string;
  badge_text: Json;
  display_order?: number;
}

export default function AllQuizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, slug, title, description, quiz_type, badge_text, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLocalizedText = (json: Json, lang: string = "en"): string => {
    if (typeof json === "string") return json;
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return (json as Record<string, string>)[lang] || (json as Record<string, string>)["en"] || "";
    }
    return "";
  };

  const getQuizTypeStyle = (type: string) => {
    switch (type) {
      case "hypothesis":
        return {
          label: "Hypothesis",
          badge: "bg-purple-600/20 text-purple-700 dark:text-purple-300 border-purple-600/30 font-medium",
          card: "hover:border-purple-600/60 hover:shadow-purple-600/15",
          accent: "group-hover:text-purple-700 dark:group-hover:text-purple-400",
        };
      case "emotional":
        return {
          label: "Emotional",
          badge: "bg-teal-600/20 text-teal-700 dark:text-teal-300 border-teal-600/30 font-medium",
          card: "hover:border-teal-600/60 hover:shadow-teal-600/15",
          accent: "group-hover:text-teal-700 dark:group-hover:text-teal-400",
        };
      default:
        return {
          label: "Quiz",
          badge: "bg-primary/20 text-primary border-primary/30 font-medium",
          card: "hover:border-primary/60 hover:shadow-primary/15",
          accent: "group-hover:text-primary",
        };
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Logo />
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Available Quizzes
          </h1>
          <p className="text-lg text-muted-foreground">
            Select a quiz to get started
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No quizzes available at the moment.
          </div>
        ) : (
          <div className="grid gap-4">
            {quizzes.map((quiz) => {
              const typeStyle = getQuizTypeStyle(quiz.quiz_type);
              const title = getLocalizedText(quiz.title) || quiz.slug;
              const description = getLocalizedText(quiz.description);
              const badgeText = getLocalizedText(quiz.badge_text);

              return (
                <Link
                  key={quiz.id}
                  to={`/${quiz.slug}`}
                  className={`group block p-6 rounded-xl border-2 border-border bg-card transition-all duration-200 shadow-sm hover:shadow-xl ${typeStyle.card}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h2 className={`text-xl font-bold text-foreground transition-colors ${typeStyle.accent}`}>
                          {title}
                        </h2>
                        <Badge variant="outline" className={typeStyle.badge}>
                          {typeStyle.label}
                        </Badge>
                        {badgeText && (
                          <Badge variant="secondary" className="text-xs font-medium">
                            {badgeText}
                          </Badge>
                        )}
                      </div>
                      {description && (
                        <p className="text-foreground/70 line-clamp-2">
                          {description}
                        </p>
                      )}
                    </div>
                    <div className={`text-foreground/50 transition-colors ${typeStyle.accent}`}>
                      <ChevronRight className="w-6 h-6" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}