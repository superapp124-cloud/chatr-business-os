import { storageEngine } from '../storage/StorageEngine';

export interface Intent {
  id: string;
  raw_text: string;
  semantic_payload: string;
  status: string;
  created_at: number;
  updated_at: number;
  created_by: string;
  correlation_id: string;
  version: number;
}

export class IntentRepository {
  public async create(intent: Intent): Promise<void> {
    const adapter = storageEngine.getAdapter();
    await adapter.insert('intents', {
      id: intent.id,
      raw_text: intent.raw_text,
      semantic_payload: intent.semantic_payload,
      status: intent.status,
      created_at: intent.created_at,
      updated_at: intent.updated_at,
      created_by: intent.created_by,
      correlation_id: intent.correlation_id,
      version: intent.version
    });
  }

  public async findById(id: string): Promise<Intent | null> {
    const adapter = storageEngine.getAdapter();
    const rows = await adapter.query<Intent>('SELECT * FROM intents WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  }
}

export const intentRepository = new IntentRepository();
