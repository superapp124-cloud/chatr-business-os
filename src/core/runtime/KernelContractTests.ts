import { kernelAPI } from './KernelAPI';
import { CHATREvent } from './types';

export class KernelContractValidator {
  
  static async runAllTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
    let passed = 0;
    let failed = 0;
    const errors: string[] = [];

    const assert = (condition: boolean, msg: string) => {
      if (condition) {
        passed++;
      } else {
        failed++;
        errors.push(`[FAILED] ${msg}`);
      }
    };

    console.group('Kernel API Contract Validation');
    try {
      // 1. Events Contract
      const testEvent: CHATREvent = {
        type: 'TEST_EVENT' as any,
        priority: 'normal',
        timestamp: Date.now(),
        payload: { test: true }
      };
      let received = false;
      const unsub = kernelAPI.events.subscribe('TEST_EVENT' as any, (ev) => {
        received = ev.payload.test === true;
      });
      kernelAPI.events.publish('TEST_EVENT' as any, { test: true });
      assert(received, 'EventBus publish and subscribe should deliver exact payload');
      unsub();

      // 2. Command Contract
      try {
        await kernelAPI.execute('UNKNOWN_COMMAND', {});
        assert(false, 'CommandBus should reject unknown commands');
      } catch (err: any) {
        assert(err.message.includes('No handler'), 'CommandBus rejects unregistered correctly');
      }

      // 3. State Contract
      const initialMode = kernelAPI.state.get('runtime').runtimeMode;
      let stateUpdateHeard = false;
      const unsubState = kernelAPI.state.subscribe('runtime', (state) => {
        if (state.runtimeMode === 'developer') stateUpdateHeard = true;
      });
      kernelAPI.state.update('runtime', () => ({ runtimeMode: 'developer' }));
      assert(stateUpdateHeard, 'StateStore strictly notifies domain subscribers');
      // restore
      kernelAPI.state.update('runtime', () => ({ runtimeMode: initialMode }));
      unsubState();

      // 4. Permission Contract
      const hasPerm = kernelAPI.permissions.check('AIEngine', 'execute:ai');
      assert(hasPerm === true, 'AIEngine should have execute:ai permission by default');

      // 5. Engine Surface Validations
      assert(typeof kernelAPI.search === 'object', 'search surface exposed');
      assert(typeof kernelAPI.timeline === 'object', 'timeline surface exposed');
      assert(typeof kernelAPI.memory === 'object', 'memory surface exposed');
      assert(typeof kernelAPI.relationship === 'object', 'relationship surface exposed');
      
      console.log(`Contract Validation Complete: ${passed} passed, ${failed} failed`);
    } catch (err: any) {
      failed++;
      errors.push(`[CRITICAL FAILED] ${err.message}`);
    }
    console.groupEnd();

    return { passed, failed, errors };
  }
}
