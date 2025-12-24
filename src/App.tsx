import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { LanguageProvider } from "@/components/quiz/LanguageContext";
import { DynamicQuiz } from "@/components/quiz/DynamicQuiz";
import { useGlobalAppearance } from "@/hooks/useGlobalAppearance";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import QuizEditor from "./pages/QuizEditor";
import AllQuizzes from "./pages/AllQuizzes";

const queryClient = new QueryClient();

// Supported language codes for URL prefix
const SUPPORTED_LANG_PREFIXES = [
  'da', 'nl', 'en', 'et', 'fi', 'fr', 'de', 'it', 'no', 'pl', 'pt', 'ru', 'es', 'sv', 'uk',
  'ro', 'el', 'cs', 'hu', 'bg', 'sk', 'hr', 'lt', 'sl', 'lv', 'ga', 'mt'
];

// Component that handles quiz with language prefix
function LanguagePrefixedQuiz() {
  const { lang, quizSlug } = useParams<{ lang: string; quizSlug: string }>();
  
  // If lang is not a valid language code, it might be a quiz slug without language prefix
  if (lang && !SUPPORTED_LANG_PREFIXES.includes(lang)) {
    // This could be a quizSlug without language prefix, redirect will handle it
    return <Navigate to={`/${lang}${quizSlug ? `/${quizSlug}` : ''}`} replace />;
  }
  
  return <DynamicQuiz languageFromUrl={lang} />;
}

function AppContent() {
  // Load and apply global appearance settings
  useGlobalAppearance();

  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Admin routes */}
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/:tab" element={<Admin />} />
          <Route path="/admin/quiz/:quizId" element={<QuizEditor />} />
          <Route path="/admin/quiz/:quizId/:tab" element={<QuizEditor />} />
          <Route path="/auth" element={<Auth />} />
          
          {/* All quizzes listing - now at root */}
          <Route path="/" element={<AllQuizzes />} />
          <Route path="/all" element={<AllQuizzes />} />
          
          {/* Quiz routes without language prefix (will detect from IP) */}
          <Route path="/quiz/:quizSlug" element={<DynamicQuiz />} />
          <Route path="/quiz/:quizSlug/:step" element={<DynamicQuiz />} />
          
          {/* Legacy routes - treat first param as potential quiz slug (placed before language-prefixed to avoid mismatching slugs as language codes) */}
          <Route path="/:quizSlug" element={<DynamicQuiz />} />
          <Route path="/:quizSlug/:step" element={<DynamicQuiz />} />
          
          {/* Language-prefixed quiz routes: /en/quiz-slug, /et/quiz-slug, etc. - these come LAST because the slug routes above are more specific for preview mode */}
          <Route path="/:lang/:quizSlug" element={<LanguagePrefixedQuiz />} />
          <Route path="/:lang/:quizSlug/:step" element={<LanguagePrefixedQuiz />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
