/**
 * FormWidget — Dynamic field-driven form.
 *
 * Renders a form from a `fields[]` schema. Works for any input collection:
 * pickup location, delivery address, patient details, job preferences, etc.
 * Lifecycle: WAITING_USER → EXECUTING → COMPLETED.
 */

import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { WidgetProps, FormWidgetPayload, FormField } from '@/core/workflow-ui';

function FieldInput({ field, value, onChange }: {
 field: FormField;
 value: unknown;
 onChange: (val: unknown) => void;
}) {
 const base = cn(
 'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5',
 'text-[13px] text-white placeholder:text-white/25',
 'focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-colors',
 );

 if (field.type === 'choice' && field.options) {
 return (
 <select
 value={String(value ?? '')}
 onChange={e => onChange(e.target.value)}
 className={cn(base, 'appearance-none cursor-pointer')}
 >
 <option value="" disabled className="bg-[#111118]">
 {field.placeholder ?? `Select ${field.label}`}
 </option>
 {field.options.map(opt => (
 <option key={opt} value={opt} className="bg-[#111118]">{opt}</option>
 ))}
 </select>
 );
 }

 if (field.type === 'textarea') {
 return (
 <textarea
 rows={3}
 value={String(value ?? '')}
 onChange={e => onChange(e.target.value)}
 placeholder={field.placeholder}
 className={cn(base, 'resize-none')}
 />
 );
 }

 const inputType = field.type === 'number' ? 'number'
 : field.type === 'date' ? 'date'
 : field.type === 'time' ? 'time'
 : field.type === 'phone' ? 'tel'
 : 'text';

 return (
 <input
 type={inputType}
 value={String(value ?? '')}
 onChange={e => onChange(e.target.value)}
 placeholder={field.placeholder}
 className={base}
 />
 );
}

const FormWidget = memo(function FormWidget({ instance, workflowId, onAction }: WidgetProps) {
 const payload = instance.payload as FormWidgetPayload;
 const [values, setValues] = useState<Record<string, unknown>>(
 () => Object.fromEntries(payload.fields.map(f => [f.id, f.value ?? '']))
 );
 const [errors, setErrors] = useState<Record<string, string>>({});

 const isExecuting = instance.lifecycle === 'EXECUTING';
 const isCompleted = instance.lifecycle === 'COMPLETED';

 const validate = (): boolean => {
 const newErrors: Record<string, string> = {};
 payload.fields.forEach(f => {
 if (f.required && !values[f.id]) {
 newErrors[f.id] = `${f.label} is required`;
 }
 });
 setErrors(newErrors);
 return Object.keys(newErrors).length === 0;
 };

 const handleSubmit = () => {
 if (!validate()) return;
 onAction({
 widgetId: instance.id,
 workflowId,
 action: 'SUBMIT',
 data: { values },
 });
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.3 }}
 className="rounded-3xl border border-white/[0.06] bg-[#111118] overflow-hidden"
 >
 {/* Header */}
 {(payload.title || payload.subtitle) && (
 <div className="px-4 pt-4 pb-2">
 {payload.title && (
 <p className="text-[13px] font-bold text-white">{payload.title}</p>
 )}
 {payload.subtitle && (
 <p className="text-[11px] text-white/40 mt-0.5">{payload.subtitle}</p>
 )}
 </div>
 )}

 {/* Fields */}
 <div className="px-4 pb-3 space-y-3">
 {payload.fields.map(field => (
 <div key={field.id}>
 <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wide mb-1.5">
 {field.label}
 {field.required && <span className="text-violet-400 ml-0.5">*</span>}
 </label>
 <FieldInput
 field={field}
 value={values[field.id]}
 onChange={val => setValues(prev => ({ ...prev, [field.id]: val }))}
 />
 {field.hint && !errors[field.id] && (
 <p className="text-[10px] text-white/25 mt-1">{field.hint}</p>
 )}
 {errors[field.id] && (
 <p className="text-[10px] text-red-400 mt-1">{errors[field.id]}</p>
 )}
 </div>
 ))}
 </div>

 {/* CTA */}
 {!isCompleted && (
 <div className="px-4 pb-4">
 <motion.button
 whileTap={{ scale: 0.97 }}
 onClick={handleSubmit}
 disabled={isExecuting}
 className={cn(
 'w-full py-3 rounded-2xl text-[14px] font-bold text-white transition-all',
 'bg-gradient-to-r from-violet-600 to-purple-600 shadow-[0_4px_16px_rgba(124,58,237,0.4)]',
 'disabled:opacity-50',
 )}
 >
 {isExecuting ? 'Submitting...' : (payload.ctaLabel ?? 'Continue')}
 </motion.button>
 </div>
 )}
 </motion.div>
 );
});

export default FormWidget;
