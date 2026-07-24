import { IStorageAdapter, IProviderRepository } from '../contracts/StorageContracts';
import { ProviderManifestV1 } from '../../architecture/contracts';

export class ProviderRepository implements IProviderRepository {
  constructor(private db: IStorageAdapter) {}

  public async saveProvider(manifest: ProviderManifestV1): Promise<void> {
    const existing = await this.db.get('providers', manifest.id);
    if (existing) {
      await this.db.update('providers', manifest.id, manifest);
    } else {
      await this.db.insert('providers', manifest);
    }
  }

  public async getProvider(id: string): Promise<ProviderManifestV1 | null> {
    return this.db.get('providers', id);
  }

  public async searchProviders(query: string): Promise<ProviderManifestV1[]> {
    return this.db.search('providers', query);
  }
}
