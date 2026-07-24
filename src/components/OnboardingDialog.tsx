import React, { useState, useEffect } from "react";
import { Camera, Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';

interface OnboardingDialogProps {
 isOpen: boolean;
 userId: string;
 onComplete: () => void;
 onSkip: () => void; // Keeping for compatibility
}

export const OnboardingDialog = ({ isOpen, userId, onComplete, onSkip }: OnboardingDialogProps) => {
 const [fullName, setFullName] = useState("");
 const [avatarUrl, setAvatarUrl] = useState("");
 const [saving, setSaving] = useState(false);
 const [uploading, setUploading] = useState(false);
 const { toast } = useToast();

 // Load existing profile data
 useEffect(() => {
 const loadProfile = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 const googleData = user?.user_metadata;
 
 const { data: existingUser } = await supabase
 .from('users')
 .select('full_name, avatar_url')
 .eq('id', userId)
 .maybeSingle();

 const finalName = existingUser?.full_name || googleData?.full_name || googleData?.name || "";
 const finalAvatar = existingUser?.avatar_url || googleData?.avatar_url || googleData?.picture || "";

 if (finalName) setFullName(finalName);
 if (finalAvatar) setAvatarUrl(finalAvatar);
 };
 
 if (userId && isOpen) loadProfile();
 }, [userId, isOpen]);

 const handlePhotoUpload = async (fromCamera: boolean) => {
 try {
 setUploading(true);
 const image = await CapacitorCamera.getPhoto({
 quality: 90,
 allowEditing: true,
 resultType: CameraResultType.DataUrl,
 source: fromCamera ? CameraSource.Camera : CameraSource.Photos,
 });

 if (!image.dataUrl) throw new Error("Failed to get image data");

 const base64Data = image.dataUrl.split(',')[1];
 const byteCharacters = atob(base64Data);
 const byteNumbers = new Array(byteCharacters.length);
 for (let i = 0; i < byteCharacters.length; i++) {
 byteNumbers[i] = byteCharacters.charCodeAt(i);
 }
 const byteArray = new Uint8Array(byteNumbers);
 const blob = new Blob([byteArray], { type: `image/${image.format || 'jpeg'}` });
 
 const fileName = `${userId}-${Date.now()}.${image.format || 'jpeg'}`;
 
 const { error: uploadError } = await supabase.storage
 .from('avatars')
 .upload(fileName, blob, { upsert: true });

 if (uploadError) throw uploadError;

 const { data: { publicUrl } } = supabase.storage
 .from('avatars')
 .getPublicUrl(fileName);

 setAvatarUrl(publicUrl);
 } catch (error: any) {
 if (error.message !== "User cancelled photos app") {
 toast({ title: "Upload failed", description: error.message, variant: "destructive" });
 }
 } finally {
 setUploading(false);
 }
 };

 const handleSave = async () => {
 const trimmedName = fullName.trim();
 if (!trimmedName) {
 toast({ title: "Name required", description: "Please enter your name", variant: "destructive" });
 return;
 }

 setSaving(true);
 try {
 const username = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || `user_${userId.slice(0, 8)}`;
 const completedAt = new Date().toISOString();

 const [{ error: userError }, { error: profileError }] = await Promise.all([
 supabase.from('users').update({
 full_name: trimmedName,
 display_name: trimmedName,
 username,
 avatar_url: avatarUrl || null,
 onboarding_completed: true,
 profile_completed_at: completedAt,
 updated_at: completedAt,
 } as any).eq('id', userId),
 
 supabase.from('profiles').update({
 full_name: trimmedName,
 username,
 avatar_url: avatarUrl || null,
 onboarding_completed: true,
 profile_completed_at: completedAt,
 } as any).eq('id', userId)
 ]);

 if (userError) throw userError;

 onComplete();
 } catch (error: any) {
 toast({ title: "Error saving profile", description: error.message, variant: "destructive" });
 } finally {
 setSaving(false);
 }
 };

 return (
 <Dialog open={isOpen} onOpenChange={(open) => !open && onSkip()}>
 <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl p-0 overflow-hidden hide-scrollbar">
 <DialogHeader className="p-6 pb-2 text-center">
 <DialogTitle className="text-page font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
 Profile info
 </DialogTitle>
 <p className="text-secondary text-muted-foreground mt-2">
 Please provide your name and an optional profile photo
 </p>
 </DialogHeader>

 <div className="p-6 space-y-8">
 <div className="flex flex-col items-center gap-4">
 <div className="relative group">
 <div className="w-28 h-28 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-primary/5 to-purple-500/5 flex items-center justify-center relative">
 {avatarUrl ? (
 <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
 ) : (
 <Camera className="w-10 h-10 text-muted-foreground/50" />
 )}
 
 {uploading && (
 <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
 <Loader2 className="w-8 h-8 animate-spin text-white" />
 </div>
 )}
 </div>
 </div>

 <div className="flex gap-3">
 <Button type="button" variant="outline" size="sm" onClick={() => handlePhotoUpload(true)} disabled={uploading} className="rounded-full px-4 border-primary/20 hover:bg-primary/5">
 <Camera className="w-4 h-4 mr-2 text-primary" /> Camera
 </Button>
 <Button type="button" variant="outline" size="sm" onClick={() => handlePhotoUpload(false)} disabled={uploading} className="rounded-full px-4 border-primary/20 hover:bg-primary/5">
 <Upload className="w-4 h-4 mr-2 text-primary" /> Gallery
 </Button>
 </div>
 </div>

 <div className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="name" className="text-secondary font-semibold text-foreground/80">Your Name</Label>
 <Input
 id="name"
 placeholder="Type your name here"
 value={fullName}
 onChange={(e) => setFullName(e.target.value)}
 className="h-14 bg-white/50 border-primary/20 focus:border-primary rounded-xl text-section px-4"
 autoFocus
 />
 </div>
 </div>

 <Button 
 onClick={handleSave} 
 disabled={saving || uploading || !fullName.trim()}
 className="w-full h-14 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
 >
 {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : "Next"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 );
};
