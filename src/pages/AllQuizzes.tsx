import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/quiz/Footer";
import { Badge } from "@/components/ui/badge";
import type { Json } from "@/integrations/supabase/types";

interface Quiz {
  id: string;
  slug: string;
  title: Json;
  description: Json;
  quiz_type: string;
  badge_text: Json;
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
        .select("id, slug, title, description, quiz_type, badge_text")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

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

  const getQuizTypeLabel = (type: string) => {
    switch (type) {
      case "hypothesis":
        return { label: "Hypothesis", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" };
      case "emotional":
        return { label: "Emotional", color: "bg-teal-500/10 text-teal-600 border-teal-500/20" };
      default:
        return { label: "Quiz", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Logo />
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Available Quizzes</h1>
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
              const typeInfo = getQuizTypeLabel(quiz.quiz_type);
              const title = getLocalizedText(quiz.title) || quiz.slug;
              const description = getLocalizedText(quiz.description);
              const badgeText = getLocalizedText(quiz.badge_text);

              return (
                <Link
                  key={quiz.id}
                  to={`/${quiz.slug}`}
                  className="group block p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">
                          {title}
                        </h2>
                        <Badge variant="outline" className={typeInfo.color}>
                          {typeInfo.label}
                        </Badge>
                        {badgeText && (
                          <Badge variant="secondary" className="text-xs">
                            {badgeText}
                          </Badge>
                        )}
                      </div>
                      {description && (
                        <p className="text-muted-foreground line-clamp-2">
                          {description}
                        </p>
                      )}
                    </div>
                    <div className="text-muted-foreground group-hover:text-primary transition-colors">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
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