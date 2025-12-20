import { useRef, useCallback, useMemo } from "react";

/**
 * Creates a stable hash for an object to detect changes
 */
function createHash(obj: unknown): string {
  return JSON.stringify(obj);
}

interface DirtyTrackingResult<T> {
  /** Mark the current state as the "clean" baseline */
  markClean: (entities: T[]) => void;
  /** Get only the entities that have changed since last markClean */
  getDirtyEntities: (current: T[]) => T[];
  /** Check if any entity is dirty */
  hasDirtyEntities: (current: T[]) => boolean;
  /** Get IDs of entities that were deleted */
  getDeletedIds: (current: T[]) => string[];
  /** Clear all tracking data */
  reset: () => void;
}

/**
 * Hook for tracking which entities have changed since the last save.
 * Uses content hashing to detect actual changes vs just re-renders.
 */
export function useDirtyTracking<T extends { id: string }>(
  getEntityKey?: (entity: T) => string
): DirtyTrackingResult<T> {
  const cleanHashesRef = useRef<Map<string, string>>(new Map());
  const cleanIdsRef = useRef<Set<string>>(new Set());

  const keyFn = getEntityKey || ((entity: T) => entity.id);

  const markClean = useCallback((entities: T[]) => {
    const newHashes = new Map<string, string>();
    const newIds = new Set<string>();
    
    for (const entity of entities) {
      const key = keyFn(entity);
      newHashes.set(key, createHash(entity));
      newIds.add(key);
    }
    
    cleanHashesRef.current = newHashes;
    cleanIdsRef.current = newIds;
  }, [keyFn]);

  const getDirtyEntities = useCallback((current: T[]): T[] => {
    const dirty: T[] = [];
    
    for (const entity of current) {
      const key = keyFn(entity);
      const currentHash = createHash(entity);
      const cleanHash = cleanHashesRef.current.get(key);
      
      // Entity is dirty if:
      // 1. It's new (no clean hash exists)
      // 2. Its content has changed (hash mismatch)
      if (!cleanHash || cleanHash !== currentHash) {
        dirty.push(entity);
      }
    }
    
    return dirty;
  }, [keyFn]);

  const hasDirtyEntities = useCallback((current: T[]): boolean => {
    return getDirtyEntities(current).length > 0;
  }, [getDirtyEntities]);

  const getDeletedIds = useCallback((current: T[]): string[] => {
    const currentIds = new Set(current.map(keyFn));
    const deleted: string[] = [];
    
    for (const cleanId of cleanIdsRef.current) {
      if (!currentIds.has(cleanId)) {
        deleted.push(cleanId);
      }
    }
    
    return deleted;
  }, [keyFn]);

  const reset = useCallback(() => {
    cleanHashesRef.current = new Map();
    cleanIdsRef.current = new Set();
  }, []);

  return useMemo(() => ({
    markClean,
    getDirtyEntities,
    hasDirtyEntities,
    getDeletedIds,
    reset,
  }), [markClean, getDirtyEntities, hasDirtyEntities, getDeletedIds, reset]);
}

/**
 * Specialized hook for tracking quiz questions with nested answers
 */
export function useQuestionsDirtyTracking() {
  const questionHashesRef = useRef<Map<string, string>>(new Map());
  const answerHashesRef = useRef<Map<string, string>>(new Map());
  const cleanQuestionIdsRef = useRef<Set<string>>(new Set());
  const cleanAnswerIdsRef = useRef<Set<string>>(new Set());

  interface Question {
    id: string;
    question_text: unknown;
    question_order: number;
    question_type: string;
    answers: Answer[];
  }

  interface Answer {
    id: string;
    answer_text: unknown;
    answer_order: number;
    score_value: number;
  }

  const markClean = useCallback((questions: Question[]) => {
    const newQuestionHashes = new Map<string, string>();
    const newAnswerHashes = new Map<string, string>();
    const newQuestionIds = new Set<string>();
    const newAnswerIds = new Set<string>();
    
    for (const q of questions) {
      // Hash question without answers for separate tracking
      const { answers, ...questionData } = q;
      newQuestionHashes.set(q.id, createHash(questionData));
      newQuestionIds.add(q.id);
      
      for (const a of answers) {
        newAnswerHashes.set(a.id, createHash(a));
        newAnswerIds.add(a.id);
      }
    }
    
    questionHashesRef.current = newQuestionHashes;
    answerHashesRef.current = newAnswerHashes;
    cleanQuestionIdsRef.current = newQuestionIds;
    cleanAnswerIdsRef.current = newAnswerIds;
  }, []);

  const getDirtyQuestions = useCallback((questions: Question[]): Question[] => {
    const dirty: Question[] = [];
    
    for (const q of questions) {
      const { answers, ...questionData } = q;
      const currentHash = createHash(questionData);
      const cleanHash = questionHashesRef.current.get(q.id);
      
      if (!cleanHash || cleanHash !== currentHash) {
        dirty.push(q);
      }
    }
    
    return dirty;
  }, []);

  const getDirtyAnswers = useCallback((questions: Question[]): { answer: Answer; questionId: string }[] => {
    const dirty: { answer: Answer; questionId: string }[] = [];
    
    for (const q of questions) {
      for (const a of q.answers) {
        const currentHash = createHash(a);
        const cleanHash = answerHashesRef.current.get(a.id);
        
        if (!cleanHash || cleanHash !== currentHash) {
          dirty.push({ answer: a, questionId: q.id });
        }
      }
    }
    
    return dirty;
  }, []);

  const getDeletedQuestionIds = useCallback((questions: Question[]): string[] => {
    const currentIds = new Set(questions.map(q => q.id));
    return Array.from(cleanQuestionIdsRef.current).filter(id => !currentIds.has(id) && !id.startsWith("new-"));
  }, []);

  const getDeletedAnswerIds = useCallback((questions: Question[]): string[] => {
    const currentIds = new Set(questions.flatMap(q => q.answers.map(a => a.id)));
    return Array.from(cleanAnswerIdsRef.current).filter(id => !currentIds.has(id) && !id.startsWith("new-"));
  }, []);

  const hasDirtyData = useCallback((questions: Question[]): boolean => {
    return getDirtyQuestions(questions).length > 0 || 
           getDirtyAnswers(questions).length > 0 ||
           getDeletedQuestionIds(questions).length > 0 ||
           getDeletedAnswerIds(questions).length > 0;
  }, [getDirtyQuestions, getDirtyAnswers, getDeletedQuestionIds, getDeletedAnswerIds]);

  const reset = useCallback(() => {
    questionHashesRef.current = new Map();
    answerHashesRef.current = new Map();
    cleanQuestionIdsRef.current = new Set();
    cleanAnswerIdsRef.current = new Set();
  }, []);

  return useMemo(() => ({
    markClean,
    getDirtyQuestions,
    getDirtyAnswers,
    getDeletedQuestionIds,
    getDeletedAnswerIds,
    hasDirtyData,
    reset,
  }), [markClean, getDirtyQuestions, getDirtyAnswers, getDeletedQuestionIds, getDeletedAnswerIds, hasDirtyData, reset]);
}
