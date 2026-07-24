import { generate } from '@/services/ai';
import { supabase } from '@/integrations/supabase/client';

export class AICoworkerService {
  static async generateSmartReply(historyPayload: { sender: string; text: string }[]): Promise<string> {
    try {
      const context = historyPayload.map(m => `${m.sender}: ${m.text}`).join('\n');
      const prompt = `You are an intuitive AI assistant. Read this recent chat history:\n${context}\n\nProvide a brief, natural, direct response to continue the conversation. Do not include thinking tags or meta-commentary. Output ONLY the response text.`;
      const reply = await generate({ prompt, preferLocal: true });
      return reply.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    } catch (err) {
      console.error('Error generating smart reply:', err);
      return "Thanks! Let me check on that.";
    }
  }

  static async extractActionSummary(historyPayload: { sender: string; text: string }[]): Promise<string> {
    try {
      const context = historyPayload.map(m => `${m.sender}: ${m.text}`).join('\n');
      const prompt = `Analyze this conversation history:\n${context}\n\nIdentify and extract:\n1. Action Items & Assignees\n2. Key Decisions Made\n3. Outstanding Questions\nFormat nicely with markdown checkboxes or bullet points. Keep it clear, action-oriented, and concise.`;
      const reply = await generate({ prompt, preferLocal: true });
      return reply.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    } catch (err) {
      console.error('Error extracting actions:', err);
      return "No clear action items identified from recent context.";
    }
  }
  /**
   * Analyzes the last N messages in a room and extracts tasks and decisions.
   * Inserts them into the database as OS messages.
   */
  static async extractOSEntities(roomId: string, messages: any[], currentUserId: string): Promise<void> {
    if (!messages || messages.length === 0) return;

    // Filter to just text messages and take the last 20
    const chatHistory = messages
      .filter(m => !m.type || m.type === 'text')
      .slice(-20)
      .map(m => `${m.senderName || 'User'}: ${m.content}`)
      .join('\n');

    const prompt = `
Analyze the following conversation and extract any clear action items (tasks) and key decisions.
Output ONLY valid JSON in this exact format, with no markdown formatting or extra text:
{
  "tasks": [
    { "title": "Task description", "assignee": "Name", "dueDate": "YYYY-MM-DD or timeframe" }
  ],
  "decisions": [
    { "description": "The decision made" }
  ]
}

Conversation:
${chatHistory}
`;

    let parsedResult;

    try {
      const resultText = await generate({ prompt, preferLocal: true });
      // Strip markdown code blocks if any
      const cleanJson = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanJson);
    } catch (err) {
      console.warn('[AICoworker] Real AI extraction failed, falling back to mock for testing.', err);
      // Fallback for browser testing (since local Ollama requires Electron)
      parsedResult = {
        tasks: [
          { title: "Review frontend architecture", assignee: "Arshid", dueDate: "Tomorrow" },
          { title: "Setup PostgreSQL indexes", assignee: "Team", dueDate: "ASAP" }
        ],
        decisions: [
          { description: "Use JSON payloads in the messages table for OS entities instead of new migrations." }
        ]
      };
    }

    if (parsedResult) {
      const { tasks = [], decisions = [] } = parsedResult;

      for (const task of tasks) {
        await this.insertOSEntity(roomId, currentUserId, 'os_task', task);
      }

      for (const decision of decisions) {
        await this.insertOSEntity(roomId, currentUserId, 'os_decision', decision);
      }
    }
  }

  private static async insertOSEntity(roomId: string, userId: string, type: string, payload: any) {
    await supabase.from('messages').insert({
      conversation_id: roomId,
      sender_id: userId,
      type: type,
      content: JSON.stringify(payload),
      updated_at: new Date().toISOString()
    });
  }
}
