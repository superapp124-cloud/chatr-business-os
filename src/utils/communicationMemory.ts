import { supabase } from '@/integrations/supabase/client';

export interface MemoryResult {
  id: string;
  conversation_id: string;
  content: string;
  similarity: number;
  memory_type: string;
}

export interface CommunicationMemoryResponse {
  success: boolean;
  answer?: string;
  sources?: MemoryResult[];
  error?: string;
}

/**
 * Invokes the search-memory Edge Function to perform a hybrid search
 * and synthesize an AI answer based on the communication memory.
 */
export async function searchCommunicationMemory(
  query: string, 
  filterType?: string
): Promise<CommunicationMemoryResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('search-memory', {
      body: { query, filter_type: filterType }
    });
    
    if (error) {
      console.error('Edge function error:', error);
      
      // Fallback message if function isn't deployed yet
      if (error.message.includes('not found') || error.message.includes('Failed to send a request')) {
        return { 
          success: false, 
          error: "Memory Engine not deployed. Please run: supabase functions deploy search-memory" 
        };
      }
      
      return { success: false, error: error.message };
    }
    
    if (data?.error) {
      return { success: false, error: data.error };
    }
    
    return { 
      success: true, 
      answer: data.answer,
      sources: data.sources || []
    };
    
  } catch (err: any) {
    console.error('Communication memory API error:', err);
    return { success: false, error: err.message || 'Failed to search memory' };
  }
}

/**
 * Invokes the backfill-memory edge function to manually trigger
 * historical message indexing.
 */
export async function backfillMemory(batchSize: number = 100): Promise<{success: boolean; message: string}> {
  try {
    const { data, error } = await supabase.functions.invoke('backfill-memory', {
      body: { batchSize }
    });
    
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    
    return { success: true, message: data.message };
  } catch (err: any) {
    console.error('Backfill error:', err);
    return { success: false, message: err.message };
  }
}
