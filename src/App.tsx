import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/components/quiz/LanguageContext";
import { DynamicQuiz } from "@/components/quiz/DynamicQuiz";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Dynamic quiz routes with unique slugs */}
            <Route path="/" element={<DynamicQuiz />} />
            <Route path="/q/:quizSlug" element={<DynamicQuiz />} />
            <Route path="/q/:quizSlug/:step" element={<DynamicQuiz />} />
            {/* Legacy routes for backwards compatibility */}
            <Route path="/quiz" element={<DynamicQuiz />} />
            <Route path="/quiz/:step" element={<DynamicQuiz />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
