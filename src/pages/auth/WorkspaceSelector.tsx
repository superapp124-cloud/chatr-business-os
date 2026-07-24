import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, User, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const WorkspaceSelector = () => {
 const navigate = useNavigate();

 const handleSelectWorkspace = (workspace: 'personal' | 'business' | 'enterprise') => {
 // In a real app, this would update the global EditionContext/State
 // and persist to localStorage or backend profile.
 localStorage.setItem('chatr_workspace', workspace);
 
 if (workspace === 'business') {
 navigate('/desktop/pro/business/inbox');
 } else if (workspace === 'enterprise') {
 navigate('/admin');
 } else {
 navigate('/home');
 }
 };

 return (
 <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
 <div className="max-w-4xl w-full space-y-8">
 <div className="text-center">
 <h1 className="text-display tracking-tight text-gray-900 dark:text-white">Choose your Workspace</h1>
 <p className="mt-4 text-section text-gray-600 dark:text-gray-400">
 Select how you want to use CHATR today. You can always switch later.
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
 {/* Personal */}
 <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => handleSelectWorkspace('personal')}>
 <CardHeader className="text-center pb-4">
 <div className="mx-auto bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-4">
 <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
 </div>
 <CardTitle>CHATR Personal</CardTitle>
 <CardDescription>For individuals and everyday use</CardDescription>
 </CardHeader>
 <CardContent>
 <ul className="space-y-2 text-secondary text-gray-600 dark:text-gray-400">
 <li className="flex items-center">✓ Private messaging & calls</li>
 <li className="flex items-center">✓ Personal AI Assistant</li>
 <li className="flex items-center">✓ Communities & Stories</li>
 </ul>
 <Button className="w-full mt-6" variant="outline">Select Personal</Button>
 </CardContent>
 </Card>

 {/* Business */}
 <Card className="border-primary shadow-lg hover:shadow-xl transition-shadow cursor-pointer relative overflow-hidden" onClick={() => handleSelectWorkspace('business')}>
 <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-label px-3 py-1 rounded-bl-lg ">
 RECOMMENDED FOR SMBs
 </div>
 <CardHeader className="text-center pb-4">
 <div className="mx-auto bg-primary/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-4">
 <Building2 className="w-8 h-8 text-primary" />
 </div>
 <CardTitle>CHATR Business</CardTitle>
 <CardDescription>For small and medium businesses</CardDescription>
 </CardHeader>
 <CardContent>
 <ul className="space-y-2 text-secondary text-gray-600 dark:text-gray-400">
 <li className="flex items-center font-medium text-gray-900 dark:text-white">✓ Team Inbox & CRM</li>
 <li className="flex items-center font-medium text-gray-900 dark:text-white">✓ AI Receptionist</li>
 <li className="flex items-center font-medium text-gray-900 dark:text-white">✓ Business Phone & IVR</li>
 </ul>
 <Button className="w-full mt-6">Select Business</Button>
 </CardContent>
 </Card>

 {/* Enterprise */}
 <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => handleSelectWorkspace('enterprise')}>
 <CardHeader className="text-center pb-4">
 <div className="mx-auto bg-purple-100 dark:bg-purple-900/30 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-4">
 <ShieldCheck className="w-8 h-8 text-purple-600 dark:text-purple-400" />
 </div>
 <CardTitle>CHATR Enterprise</CardTitle>
 <CardDescription>For large organizations</CardDescription>
 </CardHeader>
 <CardContent>
 <ul className="space-y-2 text-secondary text-gray-600 dark:text-gray-400">
 <li className="flex items-center">✓ SSO & Compliance</li>
 <li className="flex items-center">✓ Advanced Admin Console</li>
 <li className="flex items-center">✓ Device Management</li>
 </ul>
 <Button className="w-full mt-6" variant="outline">Select Enterprise</Button>
 </CardContent>
 </Card>
 </div>
 </div>
 </div>
 );
};
