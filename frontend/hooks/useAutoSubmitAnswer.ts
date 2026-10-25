import { useCallback, useEffect, useRef, useState } from "react";
import { isCorrectAnswer } from "../lib/solveQuestion";

interface Options {
  question: string | null;
  enabled: boolean; 
  onSubmit: (value: number) => Promise<void>; 
}

export function useAutoSubmitAnswer({ question, enabled, onSubmit }: Options) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false); 
  useEffect(() => {
    if (!enabled) return;
    setAnswer("");
    inputRef.current?.focus();
  }, [question, enabled]);

  const submit = useCallback(
    async (value: number) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      try {
        await onSubmit(value);
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
        inputRef.current?.focus();
      }
    },
    [onSubmit]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAnswer(value);
    if (!enabled || submittingRef.current || value.trim() === "") return;

    const num = Number(value);
    if (isCorrectAnswer(question, num)) void submit(num);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enabled || !answer.trim()) return;
    void submit(Number(answer));
  };

  return { answer, inputRef, submitting, handleChange, handleSubmit };
}