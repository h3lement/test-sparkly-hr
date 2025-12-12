import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Get or create a session ID stored in sessionStorage
const getSessionId = (): string => {
  const STORAGE_KEY = 'quiz_session_id';
  let sessionId = sessionStorage.getItem(STORAGE_KEY);
  
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, sessionId);
  }
  
  return sessionId;
};

// Track a page view
export const trackPageView = async (pageSlug: string): Promise<void> => {
  try {
    const sessionId = getSessionId();
    
    const { data, error } = await supabase.from('page_views').insert({
      session_id: sessionId,
      page_slug: pageSlug,
    }).select();
    
    if (error) {
      // Ignore duplicate key errors (already tracked this page for this session)
      if (error.code === '23505') {
        console.log(`Page already tracked for this session: ${pageSlug}`);
        return;
      }
      console.error('Failed to track page view:', error);
      return;
    }
    
    console.log(`Tracked page view: ${pageSlug}`, data);
  } catch (error) {
    console.error('Failed to track page view:', error);
  }
};

// Hook to track page view on mount
export const usePageTracking = (pageSlug: string): void => {
  const tracked = useRef(false);
  
  useEffect(() => {
    if (!tracked.current && pageSlug) {
      tracked.current = true;
      trackPageView(pageSlug);
    }
  }, [pageSlug]);
};

// Quiz step slugs that match the funnel
export const QUIZ_STEPS = {
  WELCOME: 'welcome',
  Q1: 'q1',
  Q2: 'q2',
  Q3: 'q3',
  Q4: 'q4',
  Q5: 'q5',
  Q6: 'q6',
  MINDEDNESS: 'mindedness',
  EMAIL: 'email',
  RESULTS: 'results',
} as const;

// Get the page slug for a quiz step
export const getQuizStepSlug = (step: string, questionNumber?: number): string => {
  if (step === 'quiz' && typeof questionNumber === 'number') {
    return `q${questionNumber + 1}`;
  }
  return step;
};
