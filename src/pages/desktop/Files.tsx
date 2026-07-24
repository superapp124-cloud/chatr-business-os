import React from 'react';
import { FolderOpen, FileText, Image as ImageIcon, HardDrive, Upload, Cloud } from 'lucide-react';

export const Files = () => {
 return (
 <div className="flex-1 bg-[#0a0a0c] h-full overflow-hidden flex flex-col font-sans p-8">
 <div className="max-w-6xl mx-auto w-full flex flex-col gap-8">
 
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.15)]">
 <FolderOpen className="w-6 h-6 text-blue-400" />
 </div>
 <div>
 <h1 className="text-page font-bold text-white tracking-tight">Documents & Media</h1>
 <p className="text-secondary text-slate-400 mt-1">Manage, share, and organize all your files centrally.</p>
 </div>
 </div>
 <button className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-button font-semibold shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all flex items-center gap-2">
 <Upload className="w-4 h-4" />
 Upload File
 </button>
 </div>

 {/* Storage Overview */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div className="bg-black/40 rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
 <div className="flex items-center gap-3">
 <HardDrive className="w-5 h-5 text-indigo-400" />
 <p className="text-secondary font-medium text-white">Local Storage</p>
 </div>
 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
 <div className="h-full bg-indigo-500 w-[15%] rounded-full"></div>
 </div>
 <p className="text-label text-slate-500">1.5 GB used of 10 GB</p>
 </div>
 <div className="bg-black/40 rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
 <div className="flex items-center gap-3">
 <Cloud className="w-5 h-5 text-cyan-400" />
 <p className="text-secondary font-medium text-white">Cloud Drive</p>
 </div>
 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
 <div className="h-full bg-cyan-500 w-[45%] rounded-full"></div>
 </div>
 <p className="text-label text-slate-500">45 GB used of 100 GB</p>
 </div>
 <div className="bg-black/40 rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
 <div className="flex items-center gap-3">
 <FileText className="w-5 h-5 text-emerald-400" />
 <p className="text-secondary font-medium text-white">Documents</p>
 </div>
 <p className="text-page font-bold text-white mt-auto">128</p>
 </div>
 <div className="bg-black/40 rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
 <div className="flex items-center gap-3">
 <ImageIcon className="w-5 h-5 text-pink-400" />
 <p className="text-secondary font-medium text-white">Media</p>
 </div>
 <p className="text-page font-bold text-white mt-auto">45</p>
 </div>
 </div>

 {/* Empty State */}
 <div className="flex-1 bg-[#111116] rounded-3xl border border-white/5 p-12 flex flex-col items-center justify-center text-center mt-4">
 <FolderOpen className="w-16 h-16 text-slate-700 mb-5" />
 <h2 className="text-workspace text-white mb-2">Your file repository is empty</h2>
 <p className="text-secondary text-slate-400 max-w-md">
 Upload documents, images, or link your cloud storage accounts to start organizing your files within your workspace.
 </p>
 <div className="mt-8 flex gap-4">
 <button className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-button font-semibold border border-white/10 transition-all flex items-center gap-2">
 <Cloud className="w-4 h-4" /> Connect Drive
 </button>
 <button className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-button font-semibold shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">
 Upload Files
 </button>
 </div>
 </div>

 </div>
 </div>
 );
};
