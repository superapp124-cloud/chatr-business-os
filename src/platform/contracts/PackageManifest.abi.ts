/**
 * Package ABI — v1.0.0 — FROZEN
 *
 * Defines the universal schema for Marketplace packages.
 * A Package can contain capabilities, nodes, providers, or workflows.
 * The PackageManager installs and verifies these packages.
 */

export type PackageType = 'node-pack' | 'provider-pack' | 'policy-pack' | 'workflow-pack' | 'capability-pack';

export interface PackageDependency {
  /** The package ID of the dependency */
  packageId: string;
  /** SemVer requirement (e.g. '^1.2.0') */
  version: string;
}

export interface PackageManifest {
  /** Globally unique package identifier (e.g., 'com.chatr.nodes.core') */
  id: string;
  
  /** Type of package */
  type: PackageType;
  
  /** Package version (SemVer format) */
  version: string;
  
  /** The Platform ABI version this package targets */
  abiVersion: string;
  
  /** Human-readable package name */
  name: string;
  
  /** Short description */
  description: string;
  
  /** Author or vendor of the package */
  publisher: string;
  
  /** License (e.g., 'MIT', 'Proprietary') */
  license: string;
  
  /** Required permissions for the package to operate (e.g., 'network:outbound') */
  permissions: string[];
  
  /** Other packages this package depends on */
  dependencies: PackageDependency[];
  
  /** Cryptographic signature of the package payload */
  signature?: string;
  
  /** SHA-256 checksum of the package payload */
  checksum?: string;
}
