import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserPlus, Calendar, IndianRupee, Plane, FileText, Zap, BarChart3, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface IntentAction {
 id: string;
 label: string;
 iconName: string;
 color: string;
 action: string;
}

export interface ResolvedExperience {
 identity: {
 roles: string[];
 dimensions: string[];
 };
 permissions: string[];
 enabledCapabilities: string[];
 dashboard: {
 showAIBrief: boolean;
 widgets: string[];
 };
 aiProfile: {
 tone: 'formal' | 'casual' | 'compliance-first' | 'fast';
 proactivityLevel: 'high' | 'medium' | 'low';
 };
 primaryIntents: IntentAction[];
 featureFlags: Record<string, boolean>;
}

interface ExperienceContextValue {
 experience: ResolvedExperience;
 isLoading: boolean;
}

const DEFAULT_EXPERIENCE: ResolvedExperience = {
 identity: { roles: ['user'], dimensions: ['personal'] },
 permissions: [],
 enabledCapabilities: ['core.chat', 'core.search'],
 dashboard: {
 showAIBrief: true,
 widgets: ['activity', 'tasks', 'projects', 'calendar']
 },
 aiProfile: { tone: 'casual', proactivityLevel: 'medium' },
 primaryIntents: [
 { id: 'hire', label: 'Hire someone', iconName: 'UserPlus', color: 'text-emerald-400', action: 'intent.hire' },
 { id: 'meet', label: 'Book meeting', iconName: 'Calendar', color: 'text-blue-400', action: 'intent.meet' },
 { id: 'pay', label: 'Pay vendor', iconName: 'IndianRupee', color: 'text-amber-400', action: 'intent.pay' },
 { id: 'travel', label: 'Plan trip', iconName: 'Plane', color: 'text-sky-400', action: 'intent.travel' },
 { id: 'invoice', label: 'Create invoice', iconName: 'FileText', color: 'text-purple-400', action: 'intent.invoice' },
 { id: 'workflow', label: 'Build workflow', iconName: 'Zap', color: 'text-orange-400', action: 'intent.workflow' },
 { id: 'sales', label: 'Analyze sales', iconName: 'BarChart3', color: 'text-pink-400', action: 'intent.sales' },
 { id: 'search', label: 'Search everything', iconName: 'Search', color: 'text-zinc-400', action: 'intent.search' },
 ],
 featureFlags: {},
};

const ExperienceContext = createContext<ExperienceContextValue>({
 experience: DEFAULT_EXPERIENCE,
 isLoading: true,
});

export const ExperienceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const [experience, setExperience] = useState<ResolvedExperience>(DEFAULT_EXPERIENCE);
 const [isLoading, setIsLoading] = useState(true);

 useEffect(() => {
 let mounted = true;

 const resolveExperience = async () => {
 try {
 const { data: { user } } = await supabase.auth.getUser();
 
 if (!user) {
 if (mounted) setIsLoading(false);
 return;
 }

 // In a full implementation, we would query:
 // 1. user_dimensions
 // 2. workspace_templates
 // 3. organization_policies
 // For now, we simulate resolving the context dynamically.

 // Example: If user has a specific dimension, we could alter primary intents.
 // We will keep the default rich experience for now.
 
 const resolved: ResolvedExperience = {
 ...DEFAULT_EXPERIENCE,
 // We can override based on fetched data here
 };

 if (mounted) {
 setExperience(resolved);
 setIsLoading(false);
 }
 } catch (error) {
 console.error("Failed to resolve experience context:", error);
 if (mounted) setIsLoading(false);
 }
 };

 resolveExperience();

 return () => {
 mounted = false;
 };
 }, []);

 return (
 <ExperienceContext.Provider value={{ experience, isLoading }}>
 {children}
 </ExperienceContext.Provider>
 );
};

export const useExperience = () => useContext(ExperienceContext);
