import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface QuizAnswer {
  questionId: number;
  answerId: number;
  score: number;
}

interface QuizContextType {
  currentStep: 'welcome' | 'quiz' | 'email' | 'results';
  currentQuestion: number;
  answers: QuizAnswer[];
  email: string;
  totalScore: number;
  setCurrentStep: (step: 'welcome' | 'quiz' | 'email' | 'results') => void;
  setCurrentQuestion: (q: number) => void;
  addAnswer: (answer: QuizAnswer) => void;
  setEmail: (email: string) => void;
  calculateScore: () => number;
  resetQuiz: () => void;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

export const quizQuestions = [
  {
    id: 1,
    question: "How often do you find yourself re-doing work that you delegated to employees?",
    answers: [
      { id: 1, text: "Almost never - they get it right", score: 1 },
      { id: 2, text: "Sometimes - minor fixes needed", score: 2 },
      { id: 3, text: "Often - significant rework required", score: 3 },
      { id: 4, text: "Always - it's faster to do it myself", score: 4 },
    ],
  },
  {
    id: 2,
    question: "When you set deadlines, how often are they met by your team?",
    answers: [
      { id: 1, text: "Almost always on time", score: 1 },
      { id: 2, text: "Usually, with occasional delays", score: 2 },
      { id: 3, text: "Frequently missed by days", score: 3 },
      { id: 4, text: "Deadlines are more like suggestions", score: 4 },
    ],
  },
  {
    id: 3,
    question: "How would you describe your employees' initiative level?",
    answers: [
      { id: 1, text: "Proactive - they anticipate needs", score: 1 },
      { id: 2, text: "Responsive - they follow through when asked", score: 2 },
      { id: 3, text: "Passive - they wait for detailed instructions", score: 3 },
      { id: 4, text: "Resistant - they push back on new tasks", score: 4 },
    ],
  },
  {
    id: 4,
    question: "How much of your day is spent managing employee issues vs. growing the business?",
    answers: [
      { id: 1, text: "Mostly growth work, minimal management", score: 1 },
      { id: 2, text: "Balanced between both", score: 2 },
      { id: 3, text: "More management than I'd like", score: 3 },
      { id: 4, text: "Constantly putting out fires", score: 4 },
    ],
  },
  {
    id: 5,
    question: "When problems arise, how do your employees typically respond?",
    answers: [
      { id: 1, text: "They solve problems independently", score: 1 },
      { id: 2, text: "They come with solutions, not just problems", score: 2 },
      { id: 3, text: "They escalate everything to me", score: 3 },
      { id: 4, text: "Problems often go unnoticed until critical", score: 4 },
    ],
  },
  {
    id: 6,
    question: "How confident are you in your team's ability to run things if you took a 2-week vacation?",
    answers: [
      { id: 1, text: "Very confident - things would run smoothly", score: 1 },
      { id: 2, text: "Somewhat confident - minor issues expected", score: 2 },
      { id: 3, text: "Nervous - would need to check in daily", score: 3 },
      { id: 4, text: "Terrified - the business would fall apart", score: 4 },
    ],
  },
];

export function QuizProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<'welcome' | 'quiz' | 'email' | 'results'>('welcome');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [email, setEmail] = useState('');

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

  const resetQuiz = () => {
    setCurrentStep('welcome');
    setCurrentQuestion(0);
    setAnswers([]);
    setEmail('');
  };

  return (
    <QuizContext.Provider
      value={{
        currentStep,
        currentQuestion,
        answers,
        email,
        totalScore: calculateScore(),
        setCurrentStep,
        setCurrentQuestion,
        addAnswer,
        setEmail,
        calculateScore,
        resetQuiz,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  const context = useContext(QuizContext);
  if (!context) {
    throw new Error('useQuiz must be used within a QuizProvider');
  }
  return context;
}
