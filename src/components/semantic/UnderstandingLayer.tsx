import React, { useState, useEffect } from 'react';
import type { Understanding } from '@/core/intent/types';
import { EntityToken } from './EntityToken';
import { ActionPanel } from './ActionPanel';

interface UnderstandingLayerProps {
 understanding: Understanding | null;
 isReady: boolean;
 onDismiss: () => void;
 onExecute: () => void;
}

export function UnderstandingLayer({ understanding, isReady, onDismiss, onExecute }: UnderstandingLayerProps) {
 const [showActionPanel, setShowActionPanel] = useState(false);
 const [showAffordance, setShowAffordance] = useState(false);

 // Living Pause: wait 300ms after isReady before revealing the action affordance
 useEffect(() => {
 if (isReady) {
 const timer = setTimeout(() => setShowAffordance(true), 300);
 return () => clearTimeout(timer);
 } else {
 setShowAffordance(false);
 setShowActionPanel(false);
 }
 }, [isReady]);

 // Spatial Memory: Strict ordering of entities
 // Who (people) -> When (dates) -> Where (locations) -> Related (organizations/misc)
 let allEntities: any[] = [];
 if (understanding) {
 allEntities = [
 ...understanding.entities.people.map(e => ({ ...e, group: 'person' })),
 ...understanding.entities.dates.map(e => ({ ...e, group: 'date' })),
 ...understanding.entities.locations.map(e => ({ ...e, group: 'location' })),
 ...understanding.entities.organizations.map(e => ({ ...e, group: 'org' })),
 ];
 }

 // Horizon Compactness
 const visibleEntities = allEntities.slice(0, 3);
 const overflowCount = allEntities.length - 3;

 const handleConfirm = () => {
 setShowActionPanel(false);
 onExecute();
 };

 // Determine if the horizon should be expanded
 const isExpanded = understanding && allEntities.length > 0;

 return (
 <div className="w-full">
 {/* Action Surface (Universal Modal) */}
 <div className="relative">
 {showActionPanel && understanding && (
 <ActionPanel 
 understanding={understanding}
 onDismiss={() => setShowActionPanel(false)}
 onEdit={() => setShowActionPanel(false)}
 onConfirm={handleConfirm}
 />
 )}
 </div>

 {/* The Collapsible Understanding Horizon */}
 <div 
 className="w-full overflow-hidden transition-all duration-150 ease-out flex items-center pl-3"
 style={{ 
 height: isExpanded ? '32px' : '0px',
 opacity: isExpanded ? 1 : 0,
 marginBottom: isExpanded ? '8px' : '0px'
 }}
 >
 <div 
 onClick={() => showAffordance && setShowActionPanel(true)}
 className={`flex items-center gap-1.5 w-full ${showAffordance ? 'cursor-pointer group' : ''}`}
 >
 {visibleEntities.map((entity, i) => (
 <EntityToken 
 key={`${entity.value}-${i}`}
 label={entity.value}
 type={entity.group}
 provenance={entity.provenance}
 style={{ animationDelay: `${i * 80}ms` }}
 />
 ))}

 {overflowCount > 0 && (
 <div 
 className="px-2 py-0.5 rounded text-[13px] font-medium text-gray-500 animate-fade-rise"
 style={{ animationDelay: `${visibleEntities.length * 80}ms` }}
 >
 +{overflowCount}
 </div>
 )}

 {/* Action Affordance (appears after Living Pause) */}
 {showAffordance && (
 <div className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-blue-500 hover:text-blue-600">
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
 <circle cx="12" cy="12" r="10"/>
 <polyline points="12 16 16 12 12 8"/>
 <line x1="8" y1="12" x2="16" y2="12"/>
 </svg>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
