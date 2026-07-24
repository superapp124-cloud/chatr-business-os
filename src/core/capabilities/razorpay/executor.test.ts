import { RazorpayExecutor } from './executor.js';

describe('RazorpayExecutor', () => {
  it('should execute successfully', async () => {
    const executor = new RazorpayExecutor();
    const result = await executor.execute({}, {});
    expect(result.status).toBe('success');
  });
});