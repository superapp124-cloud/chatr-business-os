/**
 * ActionWidget — Suggestion chips and quick action buttons.
 *
 * Rendered at the end of a message to offer contextual follow-up actions.
 * Works in both 'row' (horizontal scroll) and 'grid' (2-col) layouts.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { WidgetProps, ActionWidgetPayload } from '@/core/workflow-ui';
import { eventBus } from '@/core/runtime/EventBus';

const VARIANT_STYLES = {
 primary: 'bg-violet-600 text-white hover:bg-violet-500 shadow-[0_4px_12px_rgba(124,58,237,0.35)]',
 secondary: 'bg-white/[0.06] border border-white/[0.10] text-white/80 hover:bg-white/[0.10]',
 ghost: 'text-violet-300 hover:bg-violet-500/10',
 danger: 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15',
};

const ActionWidget = memo(function ActionWidget({ instance, workflowId, onAction }: WidgetProps) {
 const payload = instance.payload as ActionWidgetPayload;
 const isGrid = payload.layout === 'grid';

 const handleAction = (action: ActionWidgetPayload['actions'][number]) => {
 // If the action has a prompt, send it as a new AI message
 if (action.prompt) {
 eventBus.publish('AI_CHAT_PROMPT', { prompt: action.prompt }, { source: 'ActionWidget' });
 }

 onAction({
 widgetId: instance.id,
 workflowId,
 action: action.id.toUpperCase(),
 data: { actionId: action.id, prompt: action.prompt },
 });
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 6 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.25 }}
 className="py-1"
 >
 {payload.message && (
 <p className="text-[12px] text-white/50 mb-2 px-1">{payload.message}</p>
 )}

 <div className={cn(
 isGrid
 ? 'grid grid-cols-2 gap-2'
 : 'flex flex-wrap gap-2',
 )}>
 {payload.actions.map((action, i) => (
 <motion.button
 key={action.id}
 initial={{ opacity: 0, scale: 0.94 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: i * 0.05, duration: 0.2 }}
 whileTap={{ scale: 0.96 }}
 onClick={() => handleAction(action)}
 className={cn(
 'px-3.5 py-2 rounded-full text-[12px] font-semibold transition-all',
 VARIANT_STYLES[action.variant ?? 'secondary'],
 )}
 >
 {action.icon && <span className="mr-1.5">{action.icon}</span>}
 {action.label}
 </motion.button>
 ))}
 </div>
 </motion.div>
 );
});

export default ActionWidget;
