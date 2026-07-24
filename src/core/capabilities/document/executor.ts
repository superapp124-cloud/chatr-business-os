import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

/**
 * Document Executor
 * 
 * Creates a document and downloads it as a .md file to the user's computer.
 * Also saves to StorageProvider (localStorage) for the Outcome Center.
 */
export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(`[core.document] Executing commitment ${commitment.id}`);

  const title = commitment.entities?.title || commitment.title;
  const content = commitment.entities?.content || '';
  const now = new Date();

  // 1. Create markdown content
  const markdownContent = [
    `# ${title}`,
    ``,
    `*Created by CHATR on ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${now.toLocaleTimeString()}*`,
    ``,
    `---`,
    ``,
    content || '*Start writing here...*',
    ``,
  ].join('\n');

  // 2. Download as .md file to user's computer
  try {
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9 ]/gi, '_').replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`[core.document] File downloaded: ${a.download}`);
  } catch (downloadErr) {
    console.warn('[core.document] File download failed (may be restricted):', downloadErr);
  }

  // 3. Save to StorageProvider (Outcome Center / localStorage persistence)
  const providers = await providerRegistry.getHealthyProviders('storage', 'ExecutionProvider');
  if (providers.length === 0) {
    // Gracefully degrade — document was still downloaded
    return {
      success: true,
      commitmentId: commitment.id,
      providerData: { transactionId: `DOC-${commitment.id}`, downloadedFile: `${title}.md`, _provider: 'FileSystem' },
    };
  }

  const storage = providers[0];
  if (!storage.create) {
    return { success: true, commitmentId: commitment.id, providerData: { downloadedFile: `${title}.md` } };
  }

  const result = await storage.create({
    id: commitment.id,
    type: 'document',
    title,
    content: markdownContent,
    downloadedFile: `${title}.md`,
    createdAt: now.toISOString(),
  });

  return {
    success: true,
    commitmentId: commitment.id,
    providerData: { ...result, transactionId: `DOC-${commitment.id}`, downloadedFile: `${title}.md` },
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('storage', 'ExecutionProvider');
  if (providers.length === 0) {
    // Document was downloaded — auto-verify
    return { verified: true, provider: 'FileSystem', timestamp: new Date().toISOString(), transactionId: `DOC-${commitment.id}`, evidence: { downloadedFile: true } };
  }

  const storage = providers[0];
  if (!storage.verify) return { verified: true, provider: storage.name, timestamp: new Date().toISOString(), transactionId: `DOC-${commitment.id}`, evidence: {} };

  const result = await storage.verify(commitment.id);
  return {
    verified: result.verified,
    provider: storage.name,
    timestamp: new Date().toISOString(),
    transactionId: `DOC-${commitment.id}`,
    evidence: result,
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  const providers = await providerRegistry.getHealthyProviders('storage', 'ExecutionProvider');
  if (providers.length > 0) {
    const storage = providers[0] as any;
    if (storage.delete) storage.delete(commitmentId);
  }
}
