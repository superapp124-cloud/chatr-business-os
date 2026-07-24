import { ICapabilityExecutor } from '../RuntimeInterfaces.js';

export class RazorpayExecutor implements ICapabilityExecutor {
  async execute(intent: any, context: any): Promise<any> {
    console.log('Executing Razorpay intent:', intent);
    return { status: 'success', provider: 'Razorpay' };
  }
}