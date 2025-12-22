import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/components/quiz/LanguageContext";
import { DynamicQuiz } from "@/components/quiz/DynamicQuiz";
import { useGlobalAppearance } from "@/hooks/useGlobalAppearance";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import QuizEditor from "./pages/QuizEditor";
import AllQuizzes from "./pages/AllQuizzes";

const queryClient = new QueryClient();

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
          <Route path="/admin/quiz/:quizId" element={<QuizEditor />} />
          <Route path="/admin/quiz/:quizId/:tab" element={<QuizEditor />} />
          <Route path="/auth" element={<Auth />} />
          
          {/* All quizzes listing */}
          <Route path="/all" element={<AllQuizzes />} />
          
          {/* Dynamic quiz routes with unique slugs */}
          <Route path="/" element={<DynamicQuiz />} />
          <Route path="/:quizSlug" element={<DynamicQuiz />} />
          <Route path="/:quizSlug/:step" element={<DynamicQuiz />} />
          <Route path="/quiz/:step" element={<DynamicQuiz />} />
          
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
