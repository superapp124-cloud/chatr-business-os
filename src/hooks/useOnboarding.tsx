import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useOnboarding = (userId: string | undefined) => {
 const [isOpen, setIsOpen] = useState(false);
 const [currentStep, setCurrentStep] = useState(0);
 const { toast } = useToast();

 useEffect(() => {
 if (!userId) {
 setIsOpen(false);
 return;
 }

 const checkOnboardingStatus = async () => {
 console.log('[ONBOARDING HOOK] Checking for userId:', userId);
 
 const [{ data: userRecord, error }, { data: profileRecord }] = await Promise.all([
 supabase
 .from('users')
 .select('onboarding_completed')
 .eq('id', userId)
 .maybeSingle(),
 supabase
 .from('profiles')
 .select('onboarding_completed')
 .eq('id', userId)
 .maybeSingle(),
 ]);

 console.log('[ONBOARDING HOOK] User check:', { userRecord, profileRecord, error });

 const onboardingCompleted = userRecord?.onboarding_completed || profileRecord?.onboarding_completed;
 if (!onboardingCompleted) {
 console.log('[ONBOARDING HOOK] Opening onboarding dialog');
 setIsOpen(true);
 } else {
 console.log('[ONBOARDING HOOK] Profile complete, not showing dialog');
 setIsOpen(false);
 }
 };

 checkOnboardingStatus();
 }, [userId]);

 const completeStep = async (stepName: string) => {
 if (!userId) return;

 await supabase.from('onboarding_progress').upsert({
 user_id: userId,
 step_name: stepName,
 completed: true,
 completed_at: new Date().toISOString(),
 });
 };

 const completeOnboarding = async () => {
 if (!userId) return;

 const completedAt = new Date().toISOString();
 const [{ error }, { error: profileError }] = await Promise.all([
 supabase
 .from('users')
 .update({
 onboarding_completed: true,
 profile_completed_at: completedAt,
 updated_at: completedAt,
 } as any)
 .eq('id', userId),
 supabase
 .from('profiles')
 .update({
 onboarding_completed: true,
 profile_completed_at: completedAt,
 } as any)
 .eq('id', userId),
 ]);

 if (error) {
 toast({
 title: "Error",
 description: error.message || "Failed to complete onboarding",
 variant: "destructive",
 });
 return false;
 }

 if (profileError) {
 console.warn('[ONBOARDING HOOK] Legacy profile completion sync skipped:', profileError);
 }

 setIsOpen(false);
 return true;
 };

 const skipOnboarding = async () => {
 if (!userId) return;

 await completeOnboarding();
 toast({
 title: "Skipped onboarding",
 description: "You can complete your profile anytime from settings",
 });
 };

 return {
 isOpen,
 currentStep,
 setCurrentStep,
 completeStep,
 completeOnboarding,
 skipOnboarding,
 setIsOpen,
 };
};
