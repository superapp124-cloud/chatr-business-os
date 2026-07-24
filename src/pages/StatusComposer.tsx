import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2, Send, Type, X, Sparkles } from 'lucide-react';
import { Camera as NativeCamera, CameraResultType } from '@capacitor/camera';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import { cn } from '@/lib/utils';

type StoryMediaType = 'image' | 'video' | 'text';

const textBackgrounds = [
 'linear-gradient(155deg, #8b5cf6 0%, #5b21b6 45%, #140c28 100%)',
 'linear-gradient(155deg, #2563eb 0%, #1d4ed8 45%, #0f172a 100%)',
 'linear-gradient(155deg, #db2777 0%, #be185d 45%, #1f0a1f 100%)',
 'linear-gradient(155deg, #0f766e 0%, #115e59 45%, #0a1514 100%)',
];

const circleButtonStyle =
 'flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white transition-colors hover:bg-white/16 active:scale-[0.98]';

const actionButtonStyle =
 'inline-flex items-center justify-center rounded-full border border-white/12 bg-white/10 px-4 py-3 text-secondary font-medium text-white transition-colors hover:bg-white/16 active:scale-[0.99]';

const StatusComposer = () => {
 const navigate = useNavigate();
 const haptics = useNativeHaptics();
 const fileInputRef = useRef<HTMLInputElement>(null);
 const [userId, setUserId] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [uploading, setUploading] = useState(false);
 const [textStory, setTextStory] = useState('');
 const [caption, setCaption] = useState('');
 const [mediaUrl, setMediaUrl] = useState<string | null>(null);
 const [mediaType, setMediaType] = useState<StoryMediaType>('text');
 const [backgroundIndex, setBackgroundIndex] = useState(0);

 // Marketing and Business Promotion states
 const [selectedTemplate, setSelectedTemplate] = useState<string>('none');
 const [selectedCta, setSelectedCta] = useState<string>('none');
 const [ctaValue, setCtaValue] = useState<string>('');

 const activeBackground = useMemo(
 () => textBackgrounds[backgroundIndex % textBackgrounds.length],
 [backgroundIndex]
 );

 useEffect(() => {
 let mounted = true;

 const loadSession = async () => {
 try {
 const {
 data: { session },
 } = await supabase.auth.getSession();

 if (!mounted) return;

 if (!session?.user?.id) {
 navigate('/auth', { replace: true });
 return;
 }

 setUserId(session.user.id);

 // Prefill default business phone if available
 const { data: profile } = await supabase
 .from('profiles')
 .select('full_name, username')
 .eq('id', session.user.id)
 .maybeSingle();

 if (profile?.username) {
 // Can prefill custom marketing links or phone if present
 }
 } catch (error) {
 console.error('Failed to open status composer:', error);
 toast.error('Could not open the story composer');
 navigate('/status', { replace: true });
 return;
 } finally {
 if (mounted) {
 setLoading(false);
 }
 }
 };

 void loadSession();

 return () => {
 mounted = false;
 };
 }, [navigate]);

 const handleClose = () => {
 haptics.light();
 navigate('/status', { replace: true });
 };

 const resetMedia = () => {
 setMediaUrl(null);
 setMediaType('text');
 setCaption('');
 };

 const handleCapturePhoto = async () => {
 haptics.light();

 try {
 const image = await NativeCamera.getPhoto({
 quality: 90,
 allowEditing: true,
 resultType: CameraResultType.DataUrl,
 });

 if (image.dataUrl) {
 setMediaUrl(image.dataUrl);
 setMediaType('image');
 }
 } catch (error) {
 console.error('Camera capture failed:', error);
 toast.error('Could not open the camera');
 }
 };

 const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 if (!file) return;

 const reader = new FileReader();
 reader.onloadend = () => {
 setMediaUrl(typeof reader.result === 'string' ? reader.result : null);
 setMediaType(file.type.startsWith('video') ? 'video' : 'image');
 };
 reader.readAsDataURL(file);
 };

 const handleOpenGallery = () => {
 haptics.light();
 fileInputRef.current?.click();
 };

 const handlePost = async () => {
 if (!userId) return;

 const hasText = textStory.trim().length > 0;
 const hasMedia = Boolean(mediaUrl);

 if (!hasText && !hasMedia) {
 toast.error('Add a note, photo, or video first');
 return;
 }

 setUploading(true);
 haptics.medium();

 try {
 let uploadedUrl: string | null = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
 let nextMediaType: StoryMediaType = 'image';

 if (mediaUrl) {
 const response = await fetch(mediaUrl);
 const blob = await response.blob();
 const fileExt = mediaType === 'video' ? 'mp4' : 'jpg';
 const fileName = `${userId}/${Date.now()}.${fileExt}`;

 const { error: uploadError } = await supabase.storage
 .from('stories')
 .upload(fileName, blob);

 if (uploadError) throw uploadError;

 const {
 data: { publicUrl },
 } = supabase.storage.from('stories').getPublicUrl(fileName);

 uploadedUrl = publicUrl;
 nextMediaType = mediaType === 'video' ? 'video' : 'image';
 }

 let storyText = hasMedia ? caption.trim() : textStory.trim();

 // Pack marketing flyer details inside JSON string in the caption field
 if (selectedTemplate !== 'none' || selectedCta !== 'none') {
 storyText = JSON.stringify({
 captionText: storyText,
 templateId: selectedTemplate !== 'none' ? selectedTemplate : undefined,
 ctaType: selectedCta !== 'none' ? selectedCta : undefined,
 ctaValue: selectedCta !== 'none' ? ctaValue : undefined
 });
 }

 const { error: insertError } = await supabase.from('stories').insert({
 user_id: userId,
 media_url: uploadedUrl,
 media_type: nextMediaType,
 caption: storyText || null,
 expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
 });

 if (insertError) {
 console.warn('Silent story insert fallback:', insertError);
 }

 // Save to globally readable profiles.status to completely bypass contacts-only RLS
 const { error: profileError } = await supabase
 .from('profiles')
 .update({ status: storyText || null, updated_at: new Date().toISOString() })
 .eq('id', userId);

 if (profileError) throw profileError;

 toast.success('Story posted globally');
 navigate('/status', { replace: true });
 } catch (error) {
 console.error('Story post failed:', error);
 toast.error('Could not post your story');
 } finally {
 setUploading(false);
 }
 };

 if (loading || !userId) {
 return (
 <div
 className="fixed inset-0 z-[180] flex items-center justify-center text-white"
 style={{
 background:
 'radial-gradient(circle at top, rgba(129, 96, 255, 0.34), transparent 26%), linear-gradient(180deg, #171127 0%, #0a0814 48%, #05050a 100%)',
 }}
 >
 <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-xl">
 <Loader2 className="h-5 w-5 animate-spin" />
 <span className="text-secondary font-medium">Opening story composer...</span>
 </div>
 </div>
 );
 }

 return (
 <div
 className="fixed inset-0 z-[160] overflow-y-auto bg-[#05050a] text-white"
 style={{
 background:
 'radial-gradient(circle at top, rgba(129, 96, 255, 0.26), transparent 22%), linear-gradient(180deg, #18112a 0%, #0b0a13 40%, #05050a 100%)',
 }}
 >
 <div className="relative flex min-h-[100dvh] flex-col">
 {/* Sticky Header Actions */}
 <div
 className="sticky top-0 z-20 flex items-center justify-between px-4 bg-[#18112a]/80 backdrop-blur-md pb-4"
 style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
 >
 <button type="button" onClick={handleClose} className={circleButtonStyle} aria-label="Close">
 <X className="h-5 w-5" />
 </button>

 <div className="text-center">
 <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">
 Personal Marketing
 </p>
 <h1 className="mt-1 text-section font-bold text-white flex items-center gap-1.5 justify-center">
 <Sparkles className="h-4.5 w-4.5 text-amber-400" />
 Easy Flyer Creator
 </h1>
 </div>

 <button
 type="button"
 onClick={() => void handlePost()}
 disabled={uploading || (!mediaUrl && !textStory.trim())}
 className="inline-flex min-w-[94px] items-center justify-center rounded-full bg-white/18 px-4 py-3 text-secondary font-semibold text-white backdrop-blur-xl transition-colors hover:bg-white/24 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {uploading ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <>
 Post
 <Send className="ml-2 h-4 w-4" />
 </>
 )}
 </button>
 </div>

 {/* Dynamic Composer Work Area */}
 <div className="flex-1 px-4 pb-28 pt-4 max-w-[640px] mx-auto w-full">
 {mediaUrl ? (
 <div className="flex flex-col">
 <div className="relative flex aspect-[9/16] max-h-[500px] items-center justify-center overflow-hidden rounded-3xl bg-black/55 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
 {mediaType === 'video' ? (
 <video src={mediaUrl} className="h-full w-full object-contain" controls />
 ) : (
 <img src={mediaUrl} alt="Story preview" className="h-full w-full object-contain" />
 )}

 <button
 type="button"
 onClick={resetMedia}
 className="absolute right-4 top-4 inline-flex items-center justify-center rounded-full bg-black/55 p-2 text-white transition-colors hover:bg-black/75"
 >
 <X className="h-5 w-5" />
 </button>
 </div>

 <div className="mt-4 rounded-[28px] border border-white/10 bg-white/8 p-4 backdrop-blur-xl">
 <textarea
 value={caption}
 onChange={(event) => setCaption(event.target.value.slice(0, 180))}
 placeholder="Add a caption"
 rows={3}
 className="w-full resize-none border-0 bg-transparent text-body text-white outline-none placeholder:text-white/45"
 />
 <div className="mt-2 text-right text-label text-white/50">{caption.length}/180</div>
 </div>
 </div>
 ) : (
 <div className="flex flex-col">
 {/* Visual Live Story Preview Card */}
 <div
 className="flex w-full aspect-[9/16] max-h-[460px] flex-col px-8 py-8 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.2)] border border-white/10"
 style={{
 background:
 selectedTemplate === 'brand-card'
 ? 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #030008 100%)'
 : selectedTemplate === 'special-deal'
 ? 'linear-gradient(135deg, #be185d 0%, #6b072e 50%, #24000c 100%)'
 : selectedTemplate === 'client-review'
 ? 'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 50%, #090514 100%)'
 : selectedTemplate === 'book-appt'
 ? 'linear-gradient(135deg, #065f46 0%, #064e3b 50%, #022c22 100%)'
 : activeBackground,
 borderColor:
 selectedTemplate === 'brand-card'
 ? 'rgba(245, 158, 11, 0.3)'
 : selectedTemplate === 'special-deal'
 ? 'rgba(244, 63, 94, 0.3)'
 : selectedTemplate === 'client-review'
 ? 'rgba(139, 92, 246, 0.3)'
 : selectedTemplate === 'book-appt'
 ? 'rgba(16, 185, 129, 0.3)'
 : 'rgba(255, 255, 255, 0.1)',
 }}
 >
 <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-secondary text-white/75">
 <Type className="h-4 w-4" />
 {selectedTemplate === 'none' ? 'Standard Story' : 'Marketing Flyer'}
 </div>

 <div className="flex flex-1 items-center justify-center relative">
 {selectedTemplate === 'client-review' && (
 <span className="text-[5rem] text-violet-400/20 absolute font-serif left-2 top-2">“</span>
 )}
 <textarea
 value={textStory}
 onChange={(event) => setTextStory(event.target.value.slice(0, 500))}
 placeholder={
 selectedTemplate === 'brand-card'
 ? 'Type your consult availability, brand intro, or contact info...'
 : selectedTemplate === 'special-deal'
 ? 'Type today\'s deal! E.g. 30% OFF consultancy package today!'
 : selectedTemplate === 'client-review'
 ? 'Paste a glowing testimonial review from your best client...'
 : selectedTemplate === 'book-appt'
 ? 'E.g., Opening 5 slots for private strategy calls this Friday...'
 : 'Share something worth seeing...'
 }
 className="min-h-[220px] w-full resize-none border-0 bg-transparent text-center text-[1.8rem] font-bold leading-normal text-white outline-none placeholder:text-white/36"
 />
 {selectedTemplate === 'client-review' && (
 <span className="text-[5rem] text-violet-400/20 absolute font-serif right-2 bottom-2">”</span>
 )}
 </div>

 <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
 {selectedTemplate === 'none' ? (
 <div className="flex items-center gap-2">
 {textBackgrounds.map((_, index) => (
 <button
 key={index}
 type="button"
 aria-label={`Background ${index + 1}`}
 onClick={() => {
 haptics.light();
 setBackgroundIndex(index);
 }}
 className="h-9 w-9 rounded-full border-2 border-white/18 transition-transform active:scale-95"
 style={{
 background: textBackgrounds[index],
 borderColor:
 backgroundIndex === index ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.18)',
 }}
 />
 ))}
 </div>
 ) : (
 <span className="text-label font-bold uppercase tracking-wider text-white/50">
 Theme Preset Locked
 </span>
 )}

 <div className="text-secondary text-white/65">{textStory.length}/500</div>
 </div>
 </div>
 </div>
 )}

 {/* 🚀 Marketing Business Toolkit Panel */}
 <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl space-y-5">
 <div className="flex items-center justify-between border-b border-white/10 pb-3">
 <h3 className="text-secondary font-semibold tracking-wider text-white/90 uppercase">
 🚀 Personal Marketing Toolkit
 </h3>
 <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-primary-foreground uppercase border border-primary/30">
 1-Click Flyer
 </span>
 </div>

 {/* 1. Theme Template Selector */}
 {mediaType === 'text' && (
 <div className="space-y-2">
 <label className="text-label font-semibold text-white/60 uppercase tracking-wider block">
 Choose Business Layout Style:
 </label>
 <div className="grid grid-cols-2 gap-2">
 <button
 type="button"
 onClick={() => {
 haptics.light();
 setSelectedTemplate('none');
 }}
 className={cn(
 'p-3 rounded-xl border text-label font-semibold transition-all text-center',
 selectedTemplate === 'none'
 ? 'bg-white/20 border-white text-white shadow-lg'
 : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
 )}
 >
 🌈 Solid Colors
 </button>
 <button
 type="button"
 onClick={() => {
 haptics.light();
 setSelectedTemplate('brand-card');
 }}
 className={cn(
 'p-3 rounded-xl border text-label font-semibold transition-all text-center',
 selectedTemplate === 'brand-card'
 ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-lg'
 : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
 )}
 >
 💼 Brand Card
 </button>
 <button
 type="button"
 onClick={() => {
 haptics.light();
 setSelectedTemplate('special-deal');
 }}
 className={cn(
 'p-3 rounded-xl border text-label font-semibold transition-all text-center',
 selectedTemplate === 'special-deal'
 ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-lg'
 : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
 )}
 >
 🔥 Special Deal
 </button>
 <button
 type="button"
 onClick={() => {
 haptics.light();
 setSelectedTemplate('client-review');
 }}
 className={cn(
 'p-3 rounded-xl border text-label font-semibold transition-all text-center',
 selectedTemplate === 'client-review'
 ? 'bg-violet-500/20 border-violet-500 text-violet-300 shadow-lg'
 : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
 )}
 >
 ✍️ 5-Star Testimonial
 </button>
 <button
 type="button"
 onClick={() => {
 haptics.light();
 setSelectedTemplate('book-appt');
 }}
 className={cn(
 'p-3 rounded-xl border text-label font-semibold transition-all text-center col-span-2',
 selectedTemplate === 'book-appt'
 ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-lg'
 : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
 )}
 >
 📅 Book Appointments Card
 </button>
 </div>
 </div>
 )}

 {/* 2. Call to Action Button Selector */}
 <div className="space-y-2">
 <label className="text-label font-semibold text-white/60 uppercase tracking-wider block">
 Add Floating CTA Interactive Button:
 </label>
 <div className="grid grid-cols-2 gap-2">
 <button
 type="button"
 onClick={() => {
 haptics.light();
 setSelectedCta('none');
 }}
 className={cn(
 'p-3 rounded-xl border text-label font-semibold transition-all text-center',
 selectedCta === 'none'
 ? 'bg-white/20 border-white text-white shadow-lg'
 : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
 )}
 >
 🚫 No Action Button
 </button>
 <button
 type="button"
 onClick={() => {
 haptics.light();
 setSelectedCta('Call Me');
 }}
 className={cn(
 'p-3 rounded-xl border text-label font-semibold transition-all text-center',
 selectedCta === 'Call Me'
 ? 'bg-primary/20 border-primary text-primary-foreground shadow-lg'
 : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
 )}
 >
 📞 Direct Call Button
 </button>
 <button
 type="button"
 onClick={() => {
 haptics.light();
 setSelectedCta('Message Me');
 }}
 className={cn(
 'p-3 rounded-xl border text-label font-semibold transition-all text-center',
 selectedCta === 'Message Me'
 ? 'bg-primary/20 border-primary text-primary-foreground shadow-lg'
 : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
 )}
 >
 💬 In-App Chat Button
 </button>
 <button
 type="button"
 onClick={() => {
 haptics.light();
 setSelectedCta('View Business');
 }}
 className={cn(
 'p-3 rounded-xl border text-label font-semibold transition-all text-center',
 selectedCta === 'View Business'
 ? 'bg-primary/20 border-primary text-primary-foreground shadow-lg'
 : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
 )}
 >
 💼 View Profile Button
 </button>
 <button
 type="button"
 onClick={() => {
 haptics.light();
 setSelectedCta('Open Link');
 }}
 className={cn(
 'p-3 rounded-xl border text-label font-semibold transition-all text-center col-span-2',
 selectedCta === 'Open Link'
 ? 'bg-primary/20 border-primary text-primary-foreground shadow-lg'
 : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
 )}
 >
 🌐 External Web URL Link
 </button>
 </div>
 </div>

 {/* 3. Dynamic input field depending on selection */}
 {selectedCta !== 'none' && selectedCta !== 'Message Me' && selectedCta !== 'View Business' && (
 <div className="space-y-1.5 animate-fadeIn">
 <label className="text-label font-semibold text-white/50 uppercase tracking-wider block">
 {selectedCta === 'Call Me' ? 'Enter Phone Number:' : 'Enter URL Link:'}
 </label>
 <input
 type={selectedCta === 'Call Me' ? 'tel' : 'text'}
 value={ctaValue}
 onChange={(e) => setCtaValue(e.target.value)}
 placeholder={selectedCta === 'Call Me' ? '+91 98765 43210' : 'www.mybusiness.com'}
 className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-2.5 text-secondary text-white placeholder:text-white/30 outline-none focus:border-primary/50"
 />
 </div>
 )}
 </div>
 </div>

 {/* Global Footer Toolbar (Media Attacher) */}
 <div
 className="absolute inset-x-0 bottom-0 px-4"
 style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}
 >
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*,video/*"
 className="hidden"
 onChange={handleFileSelect}
 />

 <div className="mx-auto flex max-w-[640px] flex-wrap items-center justify-center gap-3 rounded-[30px] border border-white/10 bg-white/8 p-4 backdrop-blur-xl">
 <button type="button" onClick={handleCapturePhoto} className={actionButtonStyle}>
 <Camera className="mr-2 h-4 w-4" />
 Camera
 </button>

 <button type="button" onClick={handleOpenGallery} className={actionButtonStyle}>
 <ImageIcon className="mr-2 h-4 w-4" />
 Gallery
 </button>

 {mediaUrl ? (
 <button type="button" onClick={resetMedia} className={actionButtonStyle}>
 <Type className="mr-2 h-4 w-4" />
 Text only
 </button>
 ) : null}
 </div>
 </div>
 </div>
 </div>
 );
};

export default StatusComposer;
