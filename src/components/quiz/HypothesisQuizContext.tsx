import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface HypothesisPage {
  id: string;
  quiz_id: string;
  page_number: number;
  title: Record<string, string>;
  description: Record<string, string>;
}

export interface HypothesisQuestion {
  id: string;
  page_id: string;
  question_order: number;
  hypothesis_text: Record<string, string>;
  hypothesis_text_woman: Record<string, string>;
  hypothesis_text_man: Record<string, string>;
  interview_question: Record<string, string>;
  interview_question_woman: Record<string, string>;
  interview_question_man: Record<string, string>;
  truth_explanation: Record<string, string>;
  correct_answer_woman: boolean;
  correct_answer_man: boolean;
}

export interface HypothesisResponse {
  questionId: string;
  answerWoman: boolean | null;
  answerMan: boolean | null;
  isCorrect: boolean;
}

export interface OpenMindednessAnswer {
  id: string;
  answer_text: Record<string, string>;
  answer_order: number;
  score_value: number;
}

export interface OpenMindednessQuestionData {
  id: string;
  question_text: Record<string, string>;
  answers: OpenMindednessAnswer[];
}

export interface QuizData {
  id: string;
  slug: string;
  title: Record<string, string>;
  description: Record<string, string>;
  headline: Record<string, string>;
  headline_highlight: Record<string, string>;
  badge_text: Record<string, string>;
  duration_text: Record<string, string>;
  discover_items: Record<string, string>[];
  start_cta_text: Record<string, string>;
  start_cta_secondary_text: Record<string, string>;
  start_cta_url: string | null;
  start_cta_secondary_url: string | null;
  cta_text: Record<string, string>;
  cta_title: Record<string, string>;
  cta_description: Record<string, string>;
  cta_retry_text: Record<string, string>;
  cta_url: string | null;
  cta_retry_url: string | null;
  quiz_type: string;
  include_open_mindedness?: boolean;
}

export interface OpenMindednessAnswers {
  [answerId: string]: boolean;
}

interface HypothesisQuizContextType {
  // Quiz data
  quizData: QuizData | null;
  pages: HypothesisPage[];
  questions: HypothesisQuestion[];
  setQuizData: (data: QuizData | null) => void;
  setPages: (pages: HypothesisPage[]) => void;
  setQuestions: (questions: HypothesisQuestion[]) => void;
  
  // Open Mindedness
  openMindednessQuestion: OpenMindednessQuestionData | null;
  setOpenMindednessQuestion: (q: OpenMindednessQuestionData | null) => void;
  openMindednessAnswers: OpenMindednessAnswers;
  setOpenMindednessAnswers: (answers: OpenMindednessAnswers) => void;
  hasOpenMindedness: boolean;
  calculateOpenMindednessScore: () => number;
  
  // Quiz state
  currentStep: 'welcome' | 'quiz' | 'mindedness' | 'email' | 'results';
  currentPageIndex: number;
  currentQuestionIndex: number;
  showTruth: boolean;
  responses: HypothesisResponse[];
  sessionId: string;
  email: string;
  feedbackNewLearnings: string;
  feedbackActionPlan: string;
  
  // Actions
  setCurrentStep: (step: 'welcome' | 'quiz' | 'mindedness' | 'email' | 'results') => void;
  setCurrentPageIndex: (index: number) => void;
  setCurrentQuestionIndex: (index: number) => void;
  setShowTruth: (show: boolean) => void;
  addResponse: (response: HypothesisResponse) => void;
  setEmail: (email: string) => void;
  setFeedbackNewLearnings: (text: string) => void;
  setFeedbackActionPlan: (text: string) => void;
  resetQuiz: () => void;
  
  // Helpers
  getCurrentPage: () => HypothesisPage | undefined;
  getCurrentQuestion: () => HypothesisQuestion | undefined;
  getQuestionsForPage: (pageId: string) => HypothesisQuestion[];
  calculateScore: () => { correct: number; total: number };
  getProgress: () => { current: number; total: number };
}

const HypothesisQuizContext = createContext<HypothesisQuizContextType | undefined>(undefined);

function generateSessionId(): string {
  return crypto.randomUUID();
}

export function HypothesisQuizProvider({ children }: { children: ReactNode }) {
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [pages, setPages] = useState<HypothesisPage[]>([]);
  const [questions, setQuestions] = useState<HypothesisQuestion[]>([]);
  
  // Open Mindedness state
  const [openMindednessQuestion, setOpenMindednessQuestion] = useState<OpenMindednessQuestionData | null>(null);
  const [openMindednessAnswers, setOpenMindednessAnswers] = useState<OpenMindednessAnswers>({});
  
  const [currentStep, setCurrentStep] = useState<'welcome' | 'quiz' | 'mindedness' | 'email' | 'results'>('welcome');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showTruth, setShowTruth] = useState(false);
  const [responses, setResponses] = useState<HypothesisResponse[]>([]);
  const [sessionId] = useState(() => generateSessionId());
  const [email, setEmail] = useState('');
  const [feedbackNewLearnings, setFeedbackNewLearnings] = useState('');
  const [feedbackActionPlan, setFeedbackActionPlan] = useState('');

  const hasOpenMindedness = !!(quizData?.include_open_mindedness && openMindednessQuestion);

  const sortedPages = [...pages].sort((a, b) => a.page_number - b.page_number);

  const getCurrentPage = () => sortedPages[currentPageIndex];

  const getQuestionsForPage = (pageId: string) => {
    return questions
      .filter(q => q.page_id === pageId)
      .sort((a, b) => a.question_order - b.question_order);
  };

  const getCurrentQuestion = () => {
    const currentPage = getCurrentPage();
    if (!currentPage) return undefined;
    const pageQuestions = getQuestionsForPage(currentPage.id);
    return pageQuestions[currentQuestionIndex];
  };

  const addResponse = (response: HypothesisResponse) => {
    setResponses(prev => {
      const existing = prev.findIndex(r => r.questionId === response.questionId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = response;
        return updated;
      }
      return [...prev, response];
    });
  };

  const calculateScore = () => {
    const correct = responses.filter(r => r.isCorrect).length;
    return { correct, total: questions.length };
  };

  const calculateOpenMindednessScore = () => {
    if (!openMindednessQuestion) return 0;
    return openMindednessQuestion.answers.reduce((total, answer) => {
      if (openMindednessAnswers[answer.id]) {
        return total + (answer.score_value || 1);
      }
      return total;
    }, 0);
  };

  const getProgress = () => {
    let current = 0;
    for (let i = 0; i < currentPageIndex; i++) {
      const page = sortedPages[i];
      if (page) {
        current += getQuestionsForPage(page.id).length;
      }
    }
    current += currentQuestionIndex + 1;
    return { current, total: questions.length };
  };

  const resetQuiz = () => {
    setCurrentStep('welcome');
    setCurrentPageIndex(0);
    setCurrentQuestionIndex(0);
    setShowTruth(false);
    setResponses([]);
    setEmail('');
    setFeedbackNewLearnings('');
    setFeedbackActionPlan('');
    setOpenMindednessAnswers({});
  };

  return (
    <HypothesisQuizContext.Provider
      value={{
        quizData,
        pages,
        questions,
        setQuizData,
        setPages,
        setQuestions,
        openMindednessQuestion,
        setOpenMindednessQuestion,
        openMindednessAnswers,
        setOpenMindednessAnswers,
        hasOpenMindedness,
        calculateOpenMindednessScore,
        currentStep,
        currentPageIndex,
        currentQuestionIndex,
        showTruth,
        responses,
        sessionId,
        email,
        feedbackNewLearnings,
        feedbackActionPlan,
        setCurrentStep,
        setCurrentPageIndex,
        setCurrentQuestionIndex,
        setShowTruth,
        addResponse,
        setEmail,
        setFeedbackNewLearnings,
        setFeedbackActionPlan,
        resetQuiz,
        getCurrentPage,
        getCurrentQuestion,
        getQuestionsForPage,
        calculateScore,
        getProgress,
      }}
    >
      {children}
    </HypothesisQuizContext.Provider>
  );
}

export function useHypothesisQuiz() {
  const context = useContext(HypothesisQuizContext);
  if (!context) {
    throw new Error('useHypothesisQuiz must be used within a HypothesisQuizProvider');
  }
  return context;
}
