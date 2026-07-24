import React from 'react';
import { MetadataEngine } from './MetadataEngine';
// Assume these are the existing Shadcn/Radix components we MUST NOT change
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface FormEngineProps {
 entityName: string;
 viewName: string;
 initialData?: any;
 onSubmit: (data: any) => void;
}

export const UniversalFormEngine: React.FC<FormEngineProps> = ({ entityName, viewName, initialData, onSubmit }) => {
 const viewDef = MetadataEngine.getViewDef(entityName, viewName);
 const [formData, setFormData] = React.useState(initialData || {});

 if (!viewDef) return <div>Loading form definition...</div>;

 const layout = viewDef.layout_json?.fields || [];

 const handleChange = (field: string, value: any) => {
 setFormData((prev: any) => ({ ...prev, [field]: value }));
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 onSubmit(formData);
 };

 return (
 <form onSubmit={handleSubmit} className="space-y-4">
 {layout.map((field: any) => (
 <div key={field.name} className="flex flex-col space-y-1.5">
 <Label htmlFor={field.name}>{field.label}</Label>
 {/* Dynamically render exactly the existing UI components to ensure Zero UI Changes */}
 {field.type === 'string' && (
 <Input 
 id={field.name} 
 value={formData[field.name] || ''} 
 onChange={(e) => handleChange(field.name, e.target.value)}
 placeholder={field.placeholder}
 required={field.required}
 />
 )}
 {/* Support for other types (select, radio, etc) goes here, mapping to existing UI components */}
 </div>
 ))}
 <Button type="submit">Save</Button>
 </form>
 );
};
