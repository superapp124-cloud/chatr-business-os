import { useState, useEffect, useRef } from 'react';
import { generate } from '@/services/ai';

interface Participant {
  name: string;
  lastMeetingSummary?: string;
}

interface UseSuggestedQuestionsArgs {
  meetingTitle: string;
  participants: Participant[];
  transcript: string; // live state string from SessionWorkspace — grows over the call
}

function buildPrompt(meetingTitle: string, participants: Participant[], transcript: string): string {
  const participantLines = participants
    .map(p => `- ${p.name}${p.lastMeetingSummary ? `: ${p.lastMeetingSummary}` : ': no prior meeting history'}`)
    .join('\n');

  return `You are generating discussion questions for a live call.
Meeting: ${meetingTitle}
Participants:
${participantLines}

Recent transcript (may be partial):
${transcript.slice(-1200) || '(call just started, no transcript yet)'}

Generate exactly 4 short, specific discussion questions relevant to this call.
Return ONLY the 4 questions, one per line, no numbering, no extra text.`;
}

export function useSuggestedQuestions({ meetingTitle, participants, transcript }: UseSuggestedQuestionsArgs) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Refs keep the interval callback stable without re-registration on every change
  const lastRunLength = useRef(0);
  const transcriptRef = useRef(transcript);
  const participantsRef = useRef(participants);
  const meetingTitleRef = useRef(meetingTitle);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);
  useEffect(() => { meetingTitleRef.current = meetingTitle; }, [meetingTitle]);

  async function refresh() {
    setLoading(true);
    try {
      const prompt = buildPrompt(
        meetingTitleRef.current,
        participantsRef.current,
        transcriptRef.current,
      );
      const raw = await generate({ prompt, preferLocal: true });
      const parsed = raw
        .split('\n')
        .map(l => l.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 4);
      setQuestions(parsed);
      lastRunLength.current = transcriptRef.current.length;
    } catch (err: any) {
      console.error('[useSuggestedQuestions] generation failed', err);
      setQuestions([`❌ AI generation failed. \n\nIf you are using 100% Local AI, the AI engine is warming up in the background and preparing the models. Please wait a moment.\n\nError details: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  }

  // Initial generation on mount: uses agenda + participants only (no transcript yet)
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingTitle]); // re-run if meeting changes, not on every transcript tick

  // Re-generate every 60s once the transcript has grown meaningfully (>200 new chars)
  useEffect(() => {
    const interval = setInterval(() => {
      if (transcriptRef.current.length - lastRunLength.current > 200) {
        refresh();
      }
    }, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — no re-registration on transcript changes

  return { questions, loading, refresh };
}
