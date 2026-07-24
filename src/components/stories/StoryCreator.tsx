import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Image as ImageIcon, Send, Type, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera as NativeCamera, CameraResultType } from '@capacitor/camera';

interface StoryCreatorProps {
 userId: string;
 onClose: () => void;
}

export const StoryCreator = ({ userId, onClose }: StoryCreatorProps) => {
 const [mediaUrl, setMediaUrl] = useState<string | null>(null);
 const [mediaType, setMediaType] = useState<'image' | 'video' | 'text'>('text');
 const [caption, setCaption] = useState('');
 const [uploading, setUploading] = useState(false);
 const [textStory, setTextStory] = useState('');
 const fileInputRef = useRef<HTMLInputElement>(null);

 const handleCapturePhoto = async () => {
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
 console.error('Camera error:', error);
 toast.error('Failed to capture photo');
 }
 };

 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 const reader = new FileReader();
 reader.onloadend = () => {
 setMediaUrl(reader.result as string);
 setMediaType(file.type.startsWith('video') ? 'video' : 'image');
 };
 reader.readAsDataURL(file);
 };

 const handlePost = async () => {
 if (!mediaUrl && !textStory.trim()) {
 toast.error('Please add content to your story');
 return;
 }

 setUploading(true);

 try {
 let uploadedUrl = null;
 let storyType: 'image' | 'video' | 'text' = 'text';

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
 storyType = mediaType;
 }

 const { error: storyError } = await supabase.from('stories').insert({
 user_id: userId,
 media_url: uploadedUrl,
 media_type: storyType,
 caption: caption.trim() || textStory.trim(),
 expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
 });

 if (storyError) throw storyError;

 toast.success('Story posted');
 onClose();
 } catch (error: any) {
 console.error('Story upload error:', error);
 toast.error('Failed to post story');
 } finally {
 setUploading(false);
 }
 };

 return (
 <div
 className="fixed inset-0 z-[140] flex flex-col text-white"
 style={{
 background:
 'radial-gradient(circle at top, rgba(119,82,255,0.28), transparent 24%), linear-gradient(180deg, #171127 0%, #09070f 44%, #030305 100%)',
 }}
 >
 <div
 className="mx-auto flex h-full w-full max-w-[560px] flex-col"
 style={{
 paddingTop: 'max(14px, env(safe-area-inset-top))',
 paddingBottom: 'max(18px, env(safe-area-inset-bottom))',
 }}
 >
 <div className="flex items-center justify-between px-4 pb-4">
 <Button
 variant="ghost"
 size="icon"
 onClick={onClose}
 className="rounded-full text-white hover:bg-white/10"
 >
 <X className="h-6 w-6" />
 </Button>

 <div className="text-center">
 <p className="text-label uppercase tracking-[0.24em] text-white/55">Status</p>
 <h2 className="mt-1 text-section ">Create story</h2>
 </div>

 <Button
 onClick={handlePost}
 disabled={uploading || (!mediaUrl && !textStory.trim())}
 className="rounded-full bg-white/14 px-4 text-white hover:bg-white/20"
 >
 {uploading ? 'Posting...' : 'Post'}
 <Send className="ml-2 h-4 w-4" />
 </Button>
 </div>

 <div className="flex-1 px-4">
 {mediaUrl ? (
 <div className="relative flex h-full min-h-[420px] items-center justify-center overflow-hidden rounded-[36px] border border-white/10 bg-black/30 shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
 {mediaType === 'video' ? (
 <video src={mediaUrl} className="h-full w-full object-contain" controls />
 ) : (
 <img src={mediaUrl} alt="Story preview" className="h-full w-full object-contain" />
 )}

 <Button
 variant="ghost"
 size="icon"
 onClick={() => {
 setMediaUrl(null);
 setMediaType('text');
 setCaption('');
 }}
 className="absolute right-4 top-4 rounded-full bg-black/55 text-white hover:bg-black/70"
 >
 <X className="h-5 w-5" />
 </Button>
 </div>
 ) : (
 <div
 className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-[36px] border border-white/10 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.36)]"
 style={{
 background:
 'linear-gradient(160deg, rgba(151,106,255,0.78) 0%, rgba(79,46,180,0.96) 52%, rgba(20,14,34,0.98) 100%)',
 }}
 >
 <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-secondary text-white/75">
 <Type className="h-4 w-4" />
 Text story
 </div>

 <Textarea
 value={textStory}
 onChange={(e) => setTextStory(e.target.value.slice(0, 500))}
 placeholder="Share your thoughts..."
 className="mt-6 min-h-0 flex-1 resize-none border-0 bg-transparent px-0 text-[2rem] font-semibold leading-tight text-white shadow-none placeholder:text-white/45 focus-visible:ring-0"
 />

 <div className="mt-4 flex items-center justify-between text-secondary text-white/60">
 <span>Keep it short and clear</span>
 <span>{textStory.length}/500</span>
 </div>
 </div>
 )}
 </div>

 <div className="px-4 pt-4">
 {mediaUrl ? (
 <div className="rounded-[30px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
 <Textarea
 value={caption}
 onChange={(e) => setCaption(e.target.value.slice(0, 200))}
 placeholder="Add a caption"
 className="resize-none border-0 bg-transparent px-0 text-white shadow-none placeholder:text-white/45 focus-visible:ring-0"
 rows={3}
 />
 </div>
 ) : (
 <div className="flex items-center justify-center gap-3 rounded-[30px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*,video/*"
 className="hidden"
 onChange={handleFileSelect}
 />

 <Button
 onClick={handleCapturePhoto}
 variant="outline"
 className="rounded-full border-white/18 bg-white/10 text-white hover:bg-white/16"
 >
 <Camera className="mr-2 h-4 w-4" />
 Camera
 </Button>

 <Button
 onClick={() => fileInputRef.current?.click()}
 variant="outline"
 className="rounded-full border-white/18 bg-white/10 text-white hover:bg-white/16"
 >
 <ImageIcon className="mr-2 h-4 w-4" />
 Gallery
 </Button>
 </div>
 )}
 </div>
 </div>
 </div>
 );
};
