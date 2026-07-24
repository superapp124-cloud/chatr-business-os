import express from 'express';
import { OllamaProvider } from './providers/OllamaProvider.js';

// In a real production setup, the provider would be dynamically loaded 
// from ai_settings for the specific organization.
const currentProvider = new OllamaProvider();

export function createConversationRouter() {
  const router = express.Router();

  // POST /api/v1/conversation/chat (Standard Chat)
  router.post('/chat', async (req, res) => {
    try {
      const { messages, options } = req.body;
      const response = await currentProvider.generate(messages, options);
      res.json({ message: { role: 'assistant', content: response } });
    } catch (error) {
      console.error('[Conversation API] Chat error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/v1/conversation/stream (SSE Streaming)
  router.post('/stream', async (req, res) => {
    try {
      const { messages, options } = req.body;
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      await currentProvider.stream(messages, options, (token) => {
        // Format as SSE
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      });

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      console.error('[Conversation API] Stream error:', error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  });

  // GET /api/v1/conversation/health
  router.get('/health', async (req, res) => {
    const isHealthy = await currentProvider.health();
    res.json({ status: isHealthy ? 'healthy' : 'unhealthy', provider: 'ollama' });
  });

  return router;
}
