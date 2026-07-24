/**
 * ChatrPluginManifest.ts
 * ----------------------
 * Plugin SDK contracts for the CHATR Enterprise Workflow OS.
 *
 * Defines the full surface area of the plugin system:
 *   - Permission declarations (required & optional)
 *   - The manifest schema that every plugin must ship
 *   - Lifecycle & capability interfaces
 *   - Runtime status types
 *   - A manifest validator with actionable error messages
 *
 * Phase 4 – Plugin SDK
 */

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * `PluginPermissions` – a declarative set of capabilities a plugin may request.
 *
 * Permissions declared in `PluginManifest.required_permissions` MUST be
 * granted before the plugin is installed.  Those declared in
 * `optional_permissions` may be granted or denied without blocking installation.
 */
export interface PluginPermissions {
  /**
   * Allowlist of external hostnames or URLs the plugin is permitted to
   * contact at runtime.  Use exact hostnames (e.g. `"api.openai.com"`) or
   * CIDR-style wildcard patterns (e.g. `"*.stripe.com"`).
   *
   * An empty array means no outbound network access is permitted.
   */
  network_destinations: string[];

  /**
   * Whether the plugin is permitted to read from and write to the
   * CHATR platform's scoped storage layer (key-value store, blob store).
   */
  storage_access: boolean;

  /**
   * Whether the plugin may register long-lived background workers
   * (cron jobs, event listeners) that run outside of an active user session.
   */
  background_execution: boolean;

  /**
   * References to named secrets (defined in the tenant's Secret Manager)
   * that the plugin is allowed to read at runtime.
   * e.g. `["OPENAI_API_KEY", "SLACK_WEBHOOK_URL"]`
   */
  secret_references: string[];
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

/**
 * `PluginManifest` – the authoritative descriptor every CHATR plugin MUST ship.
 *
 * Think of this as the plugin's "package.json" for the CHATR runtime.
 * The platform reads this manifest to:
 *   1. Verify identity and provenance (id, author, signature).
 *   2. Enforce version compatibility (chatr_os_version, min_sdk_version).
 *   3. Grant or deny permissions before installation.
 *   4. Route capability invocations to the correct plugin.
 */
export interface PluginManifest {
  /** Globally unique plugin identifier (reverse-domain notation recommended). */
  id: string;

  /** Human-readable display name shown in the Plugin Marketplace UI. */
  name: string;

  /**
   * Plugin version following Semantic Versioning 2.0.0 (MAJOR.MINOR.PATCH).
   * @example "1.4.2"
   */
  version: string;

  /** Individual or organisation name responsible for this plugin. */
  author: string;

  /**
   * The range of CHATR OS versions this plugin is compatible with,
   * expressed as an npm-style semver range.
   * @example ">=4.0.0 <5.0.0"
   */
  chatr_os_version: string;

  /**
   * Minimum Plugin SDK version required to run this plugin.
   * @example "2.1.0"
   */
  min_sdk_version: string;

  /**
   * Permissions the plugin REQUIRES to operate.  The platform will refuse to
   * install the plugin if these are not granted by the tenant admin.
   */
  required_permissions: PluginPermissions;

  /**
   * Permissions the plugin would LIKE but can function without.
   * The platform will prompt the admin for these; denial is non-blocking.
   */
  optional_permissions: Partial<PluginPermissions>;

  /**
   * Identifiers of UI extension points this plugin contributes to.
   * @example ["sidebar.bottom", "workflow.node.inspector"]
   */
  ui_contributions: string[];

  /**
   * Named capability strings the plugin exposes for invocation via
   * `IChatrPlugin.execute(capability, payload, context)`.
   * @example ["summarize_text", "classify_intent", "send_notification"]
   */
  capabilities: string[];

  /** Short human-readable description displayed in the Plugin Marketplace. */
  description: string;

  /**
   * Optional cryptographic signature (base64-encoded) over the manifest
   * contents.  Used by the platform to verify publisher identity and
   * manifest integrity.  Required for plugins submitted to the official
   * CHATR Marketplace.
   */
  signature?: string;
}

// ---------------------------------------------------------------------------
// Plugin status
// ---------------------------------------------------------------------------

/**
 * `PluginStatus` – the lifecycle state of a plugin within a tenant workspace.
 *
 * State machine:
 *   pending_review → approved  → disabled → approved  (re-enable)
 *   pending_review → rejected
 *   *              → quarantined           (security incident)
 */
export type PluginStatus =
  | 'quarantined'    // Forcibly halted due to a security or compliance incident.
  | 'pending_review' // Awaiting admin/marketplace review before activation.
  | 'approved'       // Fully operational.
  | 'rejected'       // Denied by admin or marketplace review; cannot be activated.
  | 'disabled';      // Manually deactivated by the tenant admin; can be re-enabled.

// ---------------------------------------------------------------------------
// Plugin interface
// ---------------------------------------------------------------------------

/**
 * `IChatrPlugin` – the interface every CHATR plugin class MUST implement.
 *
 * The platform runtime will:
 *   1. Load the plugin module and verify it exports a class satisfying this interface.
 *   2. Instantiate the class and store `manifest` and `status` on the instance.
 *   3. Call `onInstall()` during installation and `onUninstall()` during removal.
 *   4. Route capability invocations to `execute()`.
 *
 * @example
 * export class MyPlugin implements IChatrPlugin {
 *   manifest = myManifest;
 *   status: PluginStatus = 'pending_review';
 *
 *   async onInstall() { ... }
 *   async onUninstall() { ... }
 *   async execute(capability, payload, context) { ... }
 * }
 */
export interface IChatrPlugin {
  /** The plugin's self-declared manifest. */
  manifest: PluginManifest;

  /** Current operational status assigned by the platform runtime. */
  status: PluginStatus;

  /**
   * Called exactly once when the plugin is first installed into a tenant
   * workspace.  Use this hook to:
   *   - Register webhook endpoints.
   *   - Provision required storage namespaces.
   *   - Run database migrations.
   *
   * If this rejects, the installation is rolled back and the plugin status
   * is set to `pending_review` (manual recovery required).
   */
  onInstall(): Promise<void>;

  /**
   * Called exactly once when the plugin is uninstalled from a tenant workspace.
   * Use this hook to clean up:
   *   - Registered webhooks.
   *   - Background jobs.
   *   - Any tenant data the plugin owns (if data-retention policy permits).
   *
   * Errors are logged but do NOT block uninstallation.
   */
  onUninstall(): Promise<void>;

  /**
   * Invoke a named capability exposed by this plugin.
   *
   * The platform validates that `capability` is listed in
   * `manifest.capabilities` before calling this method.
   *
   * @param capability  The capability name to invoke (must be in `manifest.capabilities`).
   * @param payload     Arbitrary input data for this capability invocation.
   * @param context     Platform-injected execution context (tenant, actor, correlation_id, etc.).
   * @returns           Arbitrary serialisable result data.
   *
   * @throws            May throw for recoverable errors; the platform will handle
   *                    retry logic according to the workflow's error-handling policy.
   */
  execute(capability: string, payload: any, context: any): Promise<any>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Result returned by `validateManifest()`.
 */
export interface ManifestValidationResult {
  /** `true` if the manifest is fully valid; `false` if any errors were found. */
  valid: boolean;

  /**
   * Human-readable error messages.  Empty when `valid` is `true`.
   * Each message identifies the offending field and describes the problem.
   */
  errors: string[];
}

/**
 * Loose semver regex: matches MAJOR.MINOR.PATCH with optional pre-release / build metadata.
 * Intentionally non-strict so it covers common variations like "1.0.0-beta.1+001".
 */
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Loose semver range regex: allows common npm range specifiers in addition to
 * bare versions (^, ~, >=, <=, >, <, =, space-separated AND, || OR).
 */
const SEMVER_RANGE_RE =
  /^[\^~<>=v\d*x.|& ,()\-+a-zA-Z]+$/;

/** Required string fields that must be non-empty. */
const REQUIRED_STRING_FIELDS: (keyof PluginManifest)[] = [
  'id',
  'name',
  'version',
  'author',
  'chatr_os_version',
  'min_sdk_version',
  'description',
];

/**
 * `validateManifest` – synchronously validates a `PluginManifest` object.
 *
 * Checks:
 *   1. All required string fields are present and non-empty.
 *   2. `version` and `min_sdk_version` conform to Semantic Versioning 2.0.0.
 *   3. `chatr_os_version` is a plausible semver range string.
 *   4. `required_permissions` and `optional_permissions` are present objects.
 *   5. `capabilities` and `ui_contributions` are arrays.
 *
 * This function is intentionally synchronous and dependency-free so it can
 * be called during module load, in workers, and in sandboxed plugin sandboxes.
 *
 * @param manifest  The manifest object to validate.
 * @returns         `{ valid: boolean; errors: string[] }`
 *
 * @example
 * const result = validateManifest(myPlugin.manifest);
 * if (!result.valid) {
 *   console.error('Invalid manifest:', result.errors);
 * }
 */
export function validateManifest(manifest: PluginManifest): ManifestValidationResult {
  const errors: string[] = [];

  if (manifest === null || typeof manifest !== 'object') {
    return { valid: false, errors: ['manifest must be a non-null object.'] };
  }

  // ── 1. Required string fields ────────────────────────────────────────────
  for (const field of REQUIRED_STRING_FIELDS) {
    const value = manifest[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`"${field}" is required and must be a non-empty string.`);
    }
  }

  // ── 2. Semver validation for `version` ───────────────────────────────────
  if (typeof manifest.version === 'string' && manifest.version.trim().length > 0) {
    if (!SEMVER_RE.test(manifest.version.trim())) {
      errors.push(
        `"version" must follow Semantic Versioning 2.0.0 (MAJOR.MINOR.PATCH). ` +
          `Received: "${manifest.version}".`,
      );
    }
  }

  // ── 3. Semver validation for `min_sdk_version` ───────────────────────────
  if (
    typeof manifest.min_sdk_version === 'string' &&
    manifest.min_sdk_version.trim().length > 0
  ) {
    if (!SEMVER_RE.test(manifest.min_sdk_version.trim())) {
      errors.push(
        `"min_sdk_version" must follow Semantic Versioning 2.0.0 (MAJOR.MINOR.PATCH). ` +
          `Received: "${manifest.min_sdk_version}".`,
      );
    }
  }

  // ── 4. Semver range for `chatr_os_version` ───────────────────────────────
  if (
    typeof manifest.chatr_os_version === 'string' &&
    manifest.chatr_os_version.trim().length > 0
  ) {
    if (!SEMVER_RANGE_RE.test(manifest.chatr_os_version.trim())) {
      errors.push(
        `"chatr_os_version" must be a valid semver range (e.g. ">=4.0.0 <5.0.0"). ` +
          `Received: "${manifest.chatr_os_version}".`,
      );
    }
  }

  // ── 5. required_permissions ──────────────────────────────────────────────
  if (
    manifest.required_permissions === null ||
    manifest.required_permissions === undefined ||
    typeof manifest.required_permissions !== 'object' ||
    Array.isArray(manifest.required_permissions)
  ) {
    errors.push('"required_permissions" must be a PluginPermissions object.');
  } else {
    const rp = manifest.required_permissions;

    if (!Array.isArray(rp.network_destinations)) {
      errors.push('"required_permissions.network_destinations" must be an array of strings.');
    }
    if (typeof rp.storage_access !== 'boolean') {
      errors.push('"required_permissions.storage_access" must be a boolean.');
    }
    if (typeof rp.background_execution !== 'boolean') {
      errors.push('"required_permissions.background_execution" must be a boolean.');
    }
    if (!Array.isArray(rp.secret_references)) {
      errors.push('"required_permissions.secret_references" must be an array of strings.');
    }
  }

  // ── 6. optional_permissions ──────────────────────────────────────────────
  if (
    manifest.optional_permissions !== null &&
    manifest.optional_permissions !== undefined &&
    (typeof manifest.optional_permissions !== 'object' ||
      Array.isArray(manifest.optional_permissions))
  ) {
    errors.push('"optional_permissions" must be a Partial<PluginPermissions> object when provided.');
  }

  // ── 7. capabilities array ────────────────────────────────────────────────
  if (!Array.isArray(manifest.capabilities)) {
    errors.push('"capabilities" must be an array of strings.');
  } else if (manifest.capabilities.some((c) => typeof c !== 'string')) {
    errors.push('"capabilities" must contain only strings.');
  }

  // ── 8. ui_contributions array ────────────────────────────────────────────
  if (!Array.isArray(manifest.ui_contributions)) {
    errors.push('"ui_contributions" must be an array of strings.');
  } else if (manifest.ui_contributions.some((c) => typeof c !== 'string')) {
    errors.push('"ui_contributions" must contain only strings.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
