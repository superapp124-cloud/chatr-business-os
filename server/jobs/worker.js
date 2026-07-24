import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client (Service Role required to bypass RLS and lock jobs)
// In production, these should be loaded from env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'dummy_service_key';
const supabase = createClient(supabaseUrl, supabaseKey);

const WORKER_ID = `worker-${Math.random().toString(36).substring(7)}`;

/**
 * Job Handlers map
 */
const handlers = {
  'checksum_generation': async (payload) => {
    console.log(`[Job] Generating checksum for file: ${payload.file_path}`);
    // A real implementation would download the file, stream to a crypto hash, and update the attachments table
    return { success: true, hash: 'fake-hash-123' };
  },
  'conversation_summary': async (payload) => {
    console.log(`[Job] Generating summary for conversation: ${payload.conversation_id}`);
    // Call the AI Provider to summarize and insert into conversation_summaries
    return { success: true };
  }
};

/**
 * Polls the background_jobs table for pending jobs
 */
async function pollJobs() {
  try {
    // 1. Fetch and Lock exactly 1 job (preventing other workers from grabbing it)
    const { data: jobs, error: fetchError } = await supabase
      .from('background_jobs')
      .update({
        status: 'processing',
        locked_at: new Date().toISOString(),
        locked_by: WORKER_ID
      })
      .eq('status', 'pending')
      .lte('run_at', new Date().toISOString())
      .limit(1)
      .select();

    if (fetchError) throw fetchError;
    if (!jobs || jobs.length === 0) return; // No jobs pending

    const job = jobs[0];
    console.log(`[Worker] Picked up job ${job.id} of type ${job.job_type}`);

    // 2. Process Job
    const handler = handlers[job.job_type];
    if (!handler) {
      throw new Error(`No handler registered for job type: ${job.job_type}`);
    }

    await handler(job.payload);

    // 3. Mark as Completed
    await supabase
      .from('background_jobs')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);
      
    console.log(`[Worker] Successfully completed job ${job.id}`);
  } catch (error) {
    console.error('[Worker] Job processing error:', error.message);
    // Real implementation would increment attempts and transition to 'failed' if attempts > max_attempts
  }
}

// Start polling every 5 seconds
export function startWorker() {
  console.log(`[Worker] Started background job processor (ID: ${WORKER_ID})`);
  setInterval(pollJobs, 5000);
}
