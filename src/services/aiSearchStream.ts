export type SearchSource = {
  index: number;
  title: string;
  url: string;
  snippet: string;
  source: string;
};

export type AISearchState = {
  query: string;
  status: "idle" | "searching" | "synthesizing" | "complete" | "error";
  steps: string[];
  currentStep: string;
  text: string;
  sources: SearchSource[];
  activeProviders: string[];
  primaryProvider: string | null;
  error: string | null;
  cached: boolean;
};

export type StreamCallbacks = {
  onStateChange: (state: Partial<AISearchState>) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
};

export class AISearchStream {
  private eventSource: EventSource | null = null;
  private get backendUrl() {
    if (import.meta.env.VITE_SEARCH_API_URL) return import.meta.env.VITE_SEARCH_API_URL;
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.hostname}:8787`;
    }
    return "http://localhost:8787";
  }

  start(query: string, category: string = "web", callbacks: StreamCallbacks) {
    this.stop();
    
    callbacks.onStateChange({
      query,
      status: "searching",
      steps: [],
      currentStep: "Initializing connection...",
      text: "",
      sources: [],
      activeProviders: [],
      primaryProvider: null,
      error: null,
      cached: false
    });

    const url = new URL(`${this.backendUrl}/api/search/fast-stream`);
    url.searchParams.append("q", query);
    url.searchParams.append("category", category);

    this.eventSource = new EventSource(url.toString());

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle tutorial payload: data.type === 'sources'
        if (data.type === "sources") {
          callbacks.onStateChange({ sources: data.cards, status: "synthesizing" });
        }
        
        // Handle tutorial payload: data.type === 'token'
        if (data.type === "token" && data.token !== undefined) {
          callbacks.onStateChange({ text: data.token, status: "synthesizing" });
        }
        
        // Handle stream end
        if (data.type === "complete") {
          callbacks.onStateChange({ status: "complete" });
          callbacks.onComplete();
          this.stop();
        }
        
        if (data.error) {
          callbacks.onError(new Error(data.error));
          this.stop();
        }
      } catch (err) {
        console.error("Failed to parse SSE event", err);
      }
    };

    this.eventSource.onerror = (err) => {
      console.error("EventSource error:", err);
      callbacks.onError(new Error("Lost connection to AI streaming server."));
      this.stop();
    };
  }

  stop() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export const aiSearchStream = new AISearchStream();
