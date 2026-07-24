import { useState, useCallback, useRef } from "react";
import { aiSearchStream, AISearchState } from "../services/aiSearchStream";

export function useAISearch() {
  const [state, setState] = useState<AISearchState>({
    query: "",
    status: "idle",
    steps: [],
    currentStep: "",
    text: "",
    sources: [],
    activeProviders: [],
    primaryProvider: null,
    error: null,
    cached: false
  });

  // Keep a ref to the latest text to properly append during high-frequency token streams
  const textRef = useRef("");

  const search = useCallback((query: string, category: string = "web") => {
    if (!query.trim()) return;

    textRef.current = "";
    
    aiSearchStream.start(query, category, {
      onStateChange: (update) => {
        setState((prev) => {
          let newText = prev.text;
          
          if (update.text !== undefined) {
             // For streaming tokens, we append
             textRef.current += update.text;
             newText = textRef.current;
          } else if (update.status === "searching") {
             // reset
             newText = "";
             textRef.current = "";
          }

          let newSteps = prev.steps;
          if (update.currentStep && update.currentStep !== prev.currentStep) {
             newSteps = [...prev.steps, update.currentStep];
          }

          return {
            ...prev,
            ...update,
            text: newText,
            steps: newSteps,
            currentStep: update.currentStep || prev.currentStep
          };
        });
      },
      onError: (error) => {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: error.message
        }));
      },
      onComplete: () => {
        setState((prev) => ({
          ...prev,
          status: "complete"
        }));
      }
    });
  }, []);

  const stop = useCallback(() => {
    aiSearchStream.stop();
    setState((prev) => ({
      ...prev,
      status: prev.status === "idle" ? "idle" : "complete"
    }));
  }, []);

  return {
    ...state,
    search,
    stop
  };
}
