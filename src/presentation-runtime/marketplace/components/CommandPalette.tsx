import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, X, Activity, Server, Users, Settings } from 'lucide-react';
import styles from './CommandPalette.module.css';
import { useNavigate } from 'react-router-dom';
import { KernelContext } from '../../providers/KernelProvider';
import { Industry, CapabilityPack } from '../models';

interface CommandPaletteProps {
 isOpen: boolean;
 onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
 const [query, setQuery] = useState('');
 const [results, setResults] = useState<{industries: Industry[], packs: CapabilityPack[]}>({industries: [], packs: []});
 const inputRef = useRef<HTMLInputElement>(null);
 const navigate = useNavigate();
 const context = React.useContext(KernelContext);

 useEffect(() => {
 if (isOpen && inputRef.current) {
 inputRef.current.focus();
 }
 }, [isOpen]);

 useEffect(() => {
 if (query && context) {
 context.marketplaceRepository.search(query).then(res => {
 setResults({ industries: res.industries, packs: res.packs });
 });
 } else {
 setResults({ industries: [], packs: [] });
 }
 }, [query, context]);

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
 e.preventDefault();
 if (isOpen) onClose();
 }
 if (e.key === 'Escape' && isOpen) {
 onClose();
 }
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [isOpen, onClose]);

 if (!isOpen) return null;

 const handleAction = (path: string) => {
 navigate(path);
 onClose();
 };

 return (
 <div className={styles.overlay} onClick={onClose}>
 <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
 <div className={styles.header}>
 <Search className={styles.searchIcon} size={20} />
 <input
 ref={inputRef}
 type="text"
 className={styles.input}
 placeholder="Search industries, capability packs, templates..."
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 />
 <button className={styles.closeBtn} onClick={onClose}>
 <X size={18} />
 </button>
 </div>
 
 <div className={styles.body}>
 {query ? (
 <div className={styles.results}>
 <div className={styles.sectionTitle}>Industries</div>
 {results.industries.map(ind => (
 <div key={ind.id} className={styles.item} onClick={() => handleAction(`/enterprise/marketplace/industry/${ind.id}`)}>
 <span className="text-workspace mr-2">{ind.icon}</span>
 <span>{ind.name}</span>
 </div>
 ))}
 {results.industries.length === 0 && <div className={styles.item} style={{opacity: 0.5}}>No industries found</div>}

 <div className={styles.sectionTitle} style={{marginTop: '1rem'}}>Capability Packs</div>
 {results.packs.map(pack => (
 <div key={pack.id} className={styles.item} onClick={() => handleAction(`/enterprise/marketplace`)}>
 <Server size={16} />
 <span>{pack.name}</span>
 <span className="text-label text-slate-500 ml-auto">{pack.category}</span>
 </div>
 ))}
 {results.packs.length === 0 && <div className={styles.item} style={{opacity: 0.5}}>No capability packs found</div>}
 </div>
 ) : (
 <>
 <div className={styles.section}>
 <div className={styles.sectionTitle}>Suggestions</div>
 <div className={styles.item} onClick={() => handleAction('/enterprise/marketplace')}>
 <Server size={16} />
 <span>Browse Capability Packs</span>
 </div>
 <div className={styles.item} onClick={() => handleAction('/enterprise/users')}>
 <Users size={16} />
 <span>Manage Users & Roles</span>
 </div>
 <div className={styles.item} onClick={() => handleAction('/enterprise/settings')}>
 <Settings size={16} />
 <span>System Settings</span>
 </div>
 <div className={styles.item} onClick={() => handleAction('/desktop/workspace-ide')}>
 <Activity size={16} />
 <span>Return to Workspace IDE</span>
 </div>
 </div>
 </>
 )}
 </div>
 
 <div className={styles.footer}>
 <span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
 <span><kbd>Enter</kbd> to select</span>
 <span><kbd>Esc</kbd> to close</span>
 </div>
 </div>
 </div>
 );
};
