import React, { useEffect, useState, useContext } from 'react';
import { KernelContext } from '../../providers/KernelProvider';
import { Industry, CapabilityPack } from '../models';
import { Link } from 'react-router-dom';
import { Search, Star, Hexagon } from 'lucide-react';

export const MarketplaceBrowser: React.FC = () => {
 const context = useContext(KernelContext);
 const [industries, setIndustries] = useState<Industry[]>([]);
 const [packs, setPacks] = useState<CapabilityPack[]>([]);

 useEffect(() => {
 if (context) {
 context.marketplaceRepository.getIndustries().then(setIndustries);
 context.marketplaceRepository.getCapabilityPacks().then(setPacks);
 }
 }, [context]);

 return (
 <div className="h-full w-full flex flex-col bg-[#0B1020] text-slate-100 overflow-y-auto">
 <header className="flex items-center justify-between px-10 py-8 border-b border-white/10 shrink-0">
 <h1 className="text-page font-bold tracking-tight">Capability Marketplace</h1>
 <div className="relative w-96">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <Search className="h-4 w-4 text-slate-400" />
 </div>
 <input 
 type="text" 
 placeholder="What would you like to build?" 
 className="w-full bg-[#131A2E] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-input text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#5B6CFF] focus:border-[#5B6CFF] transition-all"
 />
 </div>
 </header>

 <div className="p-10 flex flex-col gap-10">
 <section>
 <div className="flex items-center gap-2 mb-6">
 <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
 <h3 className="text-section text-white">Featured Industries</h3>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {industries.slice(0, 3).map(ind => (
 <div key={ind.id} className="group bg-[#131A2E] rounded-xl border border-white/10 overflow-hidden hover:border-[#5B6CFF]/50 transition-all flex flex-col">
 <div className="p-6 flex-1">
 <div className="flex items-center gap-4 mb-4">
 <div className="w-12 h-12 rounded-lg bg-[#1A2240] flex items-center justify-center text-page border border-white/5 group-hover:scale-105 transition-transform">
 {ind.icon}
 </div>
 <div>
 <h4 className="text-body font-bold text-white">{ind.name}</h4>
 <p className="text-label text-slate-400 mt-1">{ind.packCount} capabilities</p>
 </div>
 </div>
 <p className="text-secondary text-slate-400 line-clamp-2">{ind.description}</p>
 </div>
 <div className="px-6 py-4 border-t border-white/5 bg-[#1A2240]/50 flex justify-end">
 <Link 
 to={`/enterprise/marketplace/industry/${ind.id}`} 
 className="px-4 py-1.5 rounded-lg bg-[#5B6CFF]/10 text-[#5B6CFF] text-secondary font-medium hover:bg-[#5B6CFF] hover:text-white transition-all"
 >
 Explore
 </Link>
 </div>
 </div>
 ))}
 </div>
 </section>

 <section>
 <h3 className="text-section text-white mb-6">Browse All Industries</h3>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
 {industries.map(ind => (
 <Link 
 to={`/enterprise/marketplace/industry/${ind.id}`} 
 key={ind.id} 
 className="bg-[#131A2E] rounded-xl border border-white/10 p-5 flex flex-col items-center justify-center text-center hover:bg-[#1A2240] hover:border-[#5B6CFF]/50 transition-all group"
 >
 <span className="text-display mb-3 group-hover:scale-110 transition-transform">{ind.icon}</span>
 <h4 className="text-secondary font-bold text-white mb-1">{ind.name}</h4>
 <p className="text-label text-slate-500">{ind.packCount} Packs</p>
 </Link>
 ))}
 </div>
 </section>
 </div>
 </div>
 );
};
