import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Phone, MessageSquare, Briefcase, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';

interface Story {
 id: string;
 user_id: string;
 media_url: string | null;
 media_type: 'image' | 'video' | 'text';
 caption: string;
 created_at: string;
 expires_at: string;
 profile?: {
 username: string;
 avatar_url: string;
 };
}

interface StoryViewerProps {
 stories: Story[];
 currentIndex: number;
 userId: string;
 onClose: () => void;
 onNext: () => void;
 onPrevious: () => void;
}

export const StoryViewer = ({ stories, currentIndex, userId, onClose, onNext, onPrevious }: StoryViewerProps) => {
 const navigate = useNavigate();
 const haptics = useNativeHaptics();
 const [progress, setProgress] = useState(0);
 const currentStory = stories[currentIndex];
 const duration = currentStory.media_type === 'video' ? 15000 : 5000;
 const portalTarget = typeof document !== 'undefined' ? document.body : null;

 // Safe parse custom marketing meta from caption JSON string
 let parsedMetadata: any = null;
 try {
 if (currentStory.caption?.startsWith('{') && currentStory.caption?.endsWith('}')) {
 parsedMetadata = JSON.parse(currentStory.caption);
 }
 } catch (err) {
 // Treat as plain text
 }

 const captionText = parsedMetadata ? parsedMetadata.captionText : currentStory.caption;
 const ctaType = parsedMetadata?.ctaType;
 const ctaValue = parsedMetadata?.ctaValue;
 const templateId = parsedMetadata?.templateId;

 useEffect(() => {
 if (!portalTarget) return;

 const previousOverflow = portalTarget.style.overflow;
 portalTarget.style.overflow = 'hidden';

 return () => {
 portalTarget.style.overflow = previousOverflow;
 };
 }, [portalTarget]);

 useEffect(() => {
 const markAsViewed = async () => {
 await supabase.from('story_views').upsert({
 story_id: currentStory.id,
 viewer_id: userId,
 viewed_at: new Date().toISOString()
 }, { onConflict: 'story_id,viewer_id' });
 };

 markAsViewed();

 const startTime = Date.now();
 const interval = setInterval(() => {
 const elapsed = Date.now() - startTime;
 const newProgress = (elapsed / duration) * 100;
 
 if (newProgress >= 100) {
 onNext();
 } else {
 setProgress(newProgress);
 }
 }, 50);

 return () => clearInterval(interval);
 }, [currentStory.id, currentIndex, duration, userId, onNext]);

 const handlePrevious = () => {
 if (currentIndex > 0) {
 setProgress(0);
 onPrevious();
 }
 };

 const handleNext = () => {
 setProgress(0);
 onNext();
 };

 if (!portalTarget) return null;

 return createPortal(
 <div className="fixed inset-0 z-[240] flex flex-col bg-black">
 {/* Interactive Progress Indicators */}
 <div
 className="absolute inset-x-0 top-0 z-20 px-3"
 style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
 >
 <div className="flex gap-1 pb-3">
 {stories.map((_, idx) => (
 <div key={idx} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
 <div
 className="h-full bg-white transition-all"
 style={{
 width:
 idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%',
 }}
 />
 </div>
 ))}
 </div>

 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Avatar className="h-10 w-10 border-2 border-white">
 <AvatarImage src={currentStory.profile?.avatar_url} />
 <AvatarFallback className="bg-primary text-white">
 {currentStory.profile?.username?.charAt(0).toUpperCase()}
 </AvatarFallback>
 </Avatar>
 <div>
 <p className="text-secondary font-semibold text-white">{currentStory.profile?.username}</p>
 <p className="text-label text-white/70">{getTimeAgo(currentStory.created_at)}</p>
 </div>
 </div>
 <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-white hover:bg-white/15">
 <X className="h-6 w-6" />
 </Button>
 </div>
 </div>

 {/* Main Story Container */}
 <div className="relative flex-1">
 <div className="absolute left-0 top-0 z-[1] h-full w-1/3 cursor-pointer" onClick={handlePrevious} />
 <div className="absolute right-0 top-0 z-[1] h-full w-1/3 cursor-pointer" onClick={handleNext} />

 {/* Text Story / Business Promo Templates */}
 {(currentStory.media_type === 'text' || currentStory.media_url?.startsWith('data:image/gif')) ? (
 templateId === 'brand-card' ? (
 <div className="flex h-full flex-col items-center justify-center p-8 text-center relative border-[12px] border-amber-500/20" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #030008 100%)' }}>
 <div className="absolute top-28 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-label font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-lg">
 💼 BRAND PRESENTATION CARD
 </div>
 <p className="max-w-lg text-display text-amber-50 drop-shadow-md">
 {captionText}
 </p>
 </div>
 ) : templateId === 'special-deal' ? (
 <div className="flex h-full flex-col items-center justify-center p-8 text-center relative border-[12px] border-rose-500/20" style={{ background: 'linear-gradient(135deg, #be185d 0%, #6b072e 50%, #24000c 100%)' }}>
 <div className="absolute top-28 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-label font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-lg">
 🔥 TODAY'S EXCLUSIVE PROMO
 </div>
 <p className="max-w-lg text-display font-black text-rose-50 drop-shadow-md">
 {captionText}
 </p>
 </div>
 ) : templateId === 'client-review' ? (
 <div className="flex h-full flex-col items-center justify-center p-8 text-center relative border-[12px] border-violet-500/20" style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 50%, #090514 100%)' }}>
 <div className="absolute top-28 bg-violet-500/10 border border-violet-500/30 text-violet-300 text-label font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-lg">
 ⭐️⭐️⭐️⭐️⭐️ 5-STAR TESTIMONIAL
 </div>
 <span className="text-[5rem] text-violet-400/20 absolute font-serif left-8 top-44">“</span>
 <p className="max-w-lg text-page font-medium italic text-violet-100 relative z-10 px-4 drop-shadow-md">
 {captionText}
 </p>
 <span className="text-[5rem] text-violet-400/20 absolute font-serif right-8 bottom-44">”</span>
 </div>
 ) : templateId === 'book-appt' ? (
 <div className="flex h-full flex-col items-center justify-center p-8 text-center relative border-[12px] border-emerald-500/20" style={{ background: 'linear-gradient(135deg, #065f46 0%, #064e3b 50%, #022c22 100%)' }}>
 <div className="absolute top-28 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-label font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-lg">
 📅 NOW BOOKING APPOINTMENTS
 </div>
 <p className="max-w-lg text-display font-extrabold text-emerald-50 drop-shadow-md">
 {captionText}
 </p>
 </div>
 ) : (
 <div className="flex h-full items-center justify-center bg-[linear-gradient(160deg,#2b1f53_0%,#5b2ad1_44%,#1a0e39_100%)] p-8">
 <p className="max-w-lg text-center text-display font-medium text-white">
 {captionText}
 </p>
 </div>
 )
 ) : currentStory.media_type === 'video' ? (
 <video src={currentStory.media_url!} className="h-full w-full object-contain" autoPlay playsInline muted />
 ) : (
 <img src={currentStory.media_url!} alt="Story" className="h-full w-full object-contain" />
 )}

 {/* Media Story Text Suffix Overlay */}
 {captionText && currentStory.media_type !== 'text' && !currentStory.media_url?.startsWith('data:image/gif') && (
 <div
 className="absolute inset-x-0 bottom-0 px-6 pb-8"
 style={{ paddingBottom: 'max(32px, calc(env(safe-area-inset-bottom) + 16px))' }}
 >
 <p className="text-center text-section text-white drop-shadow-lg">{captionText}</p>
 </div>
 )}

 {/* Premium Marketing Call-To-Action (CTA) Interactive Button */}
 {ctaType && (
 <div className="absolute inset-x-0 bottom-14 z-20 flex justify-center px-6">
 <Button
 onClick={(event) => {
 event.stopPropagation();
 haptics.medium();
 if (ctaType === 'Call Me') {
 window.location.href = `tel:${ctaValue || '+91'}`;
 } else if (ctaType === 'Message Me') {
 navigate('/chat');
 } else if (ctaType === 'View Business') {
 navigate('/profile');
 } else if (ctaType === 'Open Link') {
 const url = ctaValue?.startsWith('http') ? ctaValue : `https://${ctaValue}`;
 window.open(url, '_blank');
 }
 }}
 className="w-full max-w-[290px] rounded-full bg-primary/30 hover:bg-primary/50 border border-white/20 text-white font-bold py-6 text-[15px] shadow-[0_8px_32px_rgba(139,92,246,0.4)] animate-pulse flex items-center justify-center gap-2 backdrop-blur-xl transition-all"
 >
 {ctaType === 'Call Me' && (
 <>
 <Phone className="h-4.5 w-4.5" />
 <span>Call Instant Now</span>
 </>
 )}
 {ctaType === 'Message Me' && (
 <>
 <MessageSquare className="h-4.5 w-4.5" />
 <span>Message Business</span>
 </>
 )}
 {ctaType === 'View Business' && (
 <>
 <Briefcase className="h-4.5 w-4.5" />
 <span>View Brand Profile</span>
 </>
 )}
 {ctaType === 'Open Link' && (
 <>
 <ExternalLink className="h-4.5 w-4.5" />
 <span>Learn More</span>
 </>
 )}
 </Button>
 </div>
 )}
 </div>

 {/* Navigation Buttons */}
 {currentIndex > 0 && (
 <button
 onClick={handlePrevious}
 className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 transition-colors hover:bg-black/70"
 >
 <ChevronLeft className="h-6 w-6 text-white" />
 </button>
 )}
 {currentIndex < stories.length - 1 && (
 <button
 onClick={handleNext}
 className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 transition-colors hover:bg-black/70"
 >
 <ChevronRight className="h-6 w-6 text-white" />
 </button>
 )}
 </div>,
 portalTarget
 );
};

function getTimeAgo(dateString: string): string {
 const date = new Date(dateString);
 const now = new Date();
 const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

 if (seconds < 60) return 'just now';
 if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
 if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
 return `${Math.floor(seconds / 86400)}d ago`;
}
