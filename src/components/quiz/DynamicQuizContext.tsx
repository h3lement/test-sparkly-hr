import React, { createContext, useContext, useState, ReactNode } from 'react';
import { QuizData, QuestionData, ResultLevelData } from '@/hooks/useQuizData';

export interface QuizAnswer {
  questionId: string;
  answerId: string;
  score: number;
}

export interface OpenMindednessAnswers {
  [key: string]: boolean;
}

interface DynamicQuizContextType {
  // Quiz data from database
  quizData: QuizData | null;
  questions: QuestionData[];
  resultLevels: ResultLevelData[];
  setQuizData: (data: QuizData | null) => void;
  setQuestions: (questions: QuestionData[]) => void;
  setResultLevels: (levels: ResultLevelData[]) => void;
  
  // Quiz state
  currentStep: 'welcome' | 'quiz' | 'mindedness' | 'email' | 'results';
  currentQuestion: number;
  answers: QuizAnswer[];
  email: string;
  totalScore: number;
  openMindednessAnswers: OpenMindednessAnswers;
  openMindednessScore: number;
  
  // Actions
  setCurrentStep: (step: 'welcome' | 'quiz' | 'mindedness' | 'email' | 'results') => void;
  setCurrentQuestion: (q: number) => void;
  addAnswer: (answer: QuizAnswer) => void;
  setEmail: (email: string) => void;
  setOpenMindednessAnswers: (answers: OpenMindednessAnswers) => void;
  calculateScore: () => number;
  calculateOpenMindednessScore: () => number;
  resetQuiz: () => void;
  
  // Helper functions
  getRegularQuestions: () => QuestionData[];
  getOpenMindednessQuestion: () => QuestionData | undefined;
  getTotalQuestionCount: () => number;
}

const DynamicQuizContext = createContext<DynamicQuizContextType | undefined>(undefined);

export function DynamicQuizProvider({ children }: { children: ReactNode }) {
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [resultLevels, setResultLevels] = useState<ResultLevelData[]>([]);
  
  const [currentStep, setCurrentStep] = useState<'welcome' | 'quiz' | 'mindedness' | 'email' | 'results'>('welcome');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [email, setEmail] = useState('');
  const [openMindednessAnswers, setOpenMindednessAnswers] = useState<OpenMindednessAnswers>({});

  // Get regular questions (not open_mindedness type)
  const getRegularQuestions = () => {
    return questions.filter(q => q.question_type !== 'open_mindedness');
  };

  // Get open mindedness question
  const getOpenMindednessQuestion = () => {
    return questions.find(q => q.question_type === 'open_mindedness');
  };

  // Total question count for progress
  const getTotalQuestionCount = () => {
    return questions.length;
  };

  const addAnswer = (answer: QuizAnswer) => {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === answer.questionId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = answer;
        return updated;
      }
      return [...prev, answer];
    });
  };

  const calculateScore = () => {
    return answers.reduce((sum, a) => sum + a.score, 0);
  };

  const calculateOpenMindednessScore = () => {
    return Object.values(openMindednessAnswers).filter(Boolean).length;
  };

  const resetQuiz = () => {
    setCurrentStep('welcome');
    setCurrentQuestion(0);
    setAnswers([]);
    setEmail('');
    setOpenMindednessAnswers({});
  };

  return (
    <DynamicQuizContext.Provider
      value={{
        quizData,
        questions,
        resultLevels,
        setQuizData,
        setQuestions,
        setResultLevels,
        currentStep,
        currentQuestion,
        answers,
        email,
        totalScore: calculateScore(),
        openMindednessAnswers,
        openMindednessScore: calculateOpenMindednessScore(),
        setCurrentStep,
        setCurrentQuestion,
        addAnswer,
        setEmail,
        setOpenMindednessAnswers,
        calculateScore,
        calculateOpenMindednessScore,
        resetQuiz,
        getRegularQuestions,
        getOpenMindednessQuestion,
        getTotalQuestionCount,
      }}
    >
      {children}
    </DynamicQuizContext.Provider>
  );
}

export function useDynamicQuiz() {
  const context = useContext(DynamicQuizContext);
  if (!context) {
    throw new Error('useDynamicQuiz must be used within a DynamicQuizProvider');
  }
  return context;
}
