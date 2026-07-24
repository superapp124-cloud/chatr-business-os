/**
 * Kernel Boot — v1.0 ABI Edition (Phase 3A World Model)
 */
import { kernel } from '../abi/KernelImpl';
import { bootKernel } from './KernelBootstrap';

// ── Legacy services (kept working during migration) ──────────────────────────
import './EventBus';
import './StateStore';
import './CRE';
import './PolicyService';
import './Scheduler';
import './ProcessService';
import './VerificationService';
import './ObservabilityService';
import './IntentService';

// Boot immediately on import
bootKernel().catch(err => {
  console.error('[Kernel] Boot failed:', err);
});

// Export kernel for direct use in tests / dev tools
export { kernel };
