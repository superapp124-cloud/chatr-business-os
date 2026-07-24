import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export interface FormField {
 id: string;
 type: 'text' | 'number' | 'email' | 'date' | 'textarea' | 'select';
 label: string;
 required?: boolean;
 options?: string[]; // For select inputs
 placeholder?: string;
}

export interface DynamicFormProps {
 title: string;
 description?: string;
 fields: FormField[];
 onSubmit: (data: Record<string, any>) => void;
 submitLabel?: string;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({ 
 title, 
 description, 
 fields, 
 onSubmit, 
 submitLabel = 'Submit' 
}) => {
 const [formData, setFormData] = useState<Record<string, any>>({});

 const handleChange = (id: string, value: any) => {
 setFormData(prev => ({ ...prev, [id]: value }));
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 onSubmit(formData);
 };

 return (
 <Card className="p-6 bg-white border-slate-200 shadow-sm w-full max-w-2xl">
 <div className="mb-6">
 <h2 className="text-workspace font-bold text-slate-800">{title}</h2>
 {description && <p className="text-secondary text-slate-500 mt-1">{description}</p>}
 </div>

 <form onSubmit={handleSubmit} className="space-y-5">
 {fields.map(field => (
 <div key={field.id} className="space-y-2">
 <Label htmlFor={field.id} className="text-secondary font-semibold text-slate-700">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 </Label>
 
 {field.type === 'textarea' ? (
 <textarea
 id={field.id}
 required={field.required}
 placeholder={field.placeholder}
 className="w-full min-h-[100px] p-3 text-secondary bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#5c22ff]/50"
 value={formData[field.id] || ''}
 onChange={(e) => handleChange(field.id, e.target.value)}
 />
 ) : field.type === 'select' ? (
 <select
 id={field.id}
 required={field.required}
 className="w-full p-2.5 text-secondary bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#5c22ff]/50"
 value={formData[field.id] || ''}
 onChange={(e) => handleChange(field.id, e.target.value)}
 >
 <option value="" disabled>Select an option</option>
 {field.options?.map(opt => (
 <option key={opt} value={opt}>{opt}</option>
 ))}
 </select>
 ) : (
 <Input
 id={field.id}
 type={field.type}
 required={field.required}
 placeholder={field.placeholder}
 className="bg-slate-50 border-slate-200 focus:border-[#5c22ff]/30"
 value={formData[field.id] || ''}
 onChange={(e) => handleChange(field.id, e.target.value)}
 />
 )}
 </div>
 ))}

 <div className="pt-4 border-t border-slate-100 flex justify-end">
 <Button type="submit" className="bg-[#5c22ff] hover:bg-[#4b1ac4] text-white px-8">
 {submitLabel}
 </Button>
 </div>
 </form>
 </Card>
 );
};
