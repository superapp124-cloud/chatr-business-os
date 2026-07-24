import * as fs from 'fs';
import * as path from 'path';
import type { PackageManifest } from '../contracts/PackageManifest.abi';

export interface InstalledPackage {
  manifest: PackageManifest;
  installDate: string;
  location: string;
  status: 'active' | 'inactive';
}

/**
 * Persists the state of installed packages to disk.
 * Simulates OS-level package database (e.g. /var/lib/dpkg/status)
 */
export class PackageRegistry {
  private registryPath: string;
  private packages = new Map<string, InstalledPackage>();

  constructor(registryPath: string = path.join(process.cwd(), '.chatr', 'registry.json')) {
    this.registryPath = registryPath;
    this.load();
  }

  private load() {
    if (fs.existsSync(this.registryPath)) {
      try {
        const data = fs.readFileSync(this.registryPath, 'utf8');
        const parsed = JSON.parse(data);
        for (const [id, pkg] of Object.entries(parsed)) {
          this.packages.set(id, pkg as InstalledPackage);
        }
      } catch (e) {
        console.error('Failed to parse registry.json', e);
      }
    }
  }

  private save() {
    const dir = path.dirname(this.registryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = Object.fromEntries(this.packages);
    fs.writeFileSync(this.registryPath, JSON.stringify(data, null, 2), 'utf8');
  }

  register(pkg: InstalledPackage): void {
    if (this.packages.has(pkg.manifest.id)) {
      throw new Error(`Package ${pkg.manifest.id} is already registered.`);
    }
    this.packages.set(pkg.manifest.id, pkg);
    this.save();
  }

  update(pkg: InstalledPackage): void {
    if (!this.packages.has(pkg.manifest.id)) {
      throw new Error(`Package ${pkg.manifest.id} is not registered.`);
    }
    this.packages.set(pkg.manifest.id, pkg);
    this.save();
  }

  unregister(packageId: string): void {
    if (this.packages.has(packageId)) {
      this.packages.delete(packageId);
      this.save();
    }
  }

  get(packageId: string): InstalledPackage | undefined {
    return this.packages.get(packageId);
  }

  list(): InstalledPackage[] {
    return Array.from(this.packages.values());
  }

  has(packageId: string): boolean {
    return this.packages.has(packageId);
  }

  /**
   * Cleans the registry entirely (useful for tests)
   */
  clear(): void {
    this.packages.clear();
    if (fs.existsSync(this.registryPath)) {
      fs.unlinkSync(this.registryPath);
    }
  }
}
