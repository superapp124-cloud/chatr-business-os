import React from 'react';
import type { Understanding } from '@/core/intent/types';

interface ActionPanelProps {
 understanding: Understanding;
 onConfirm: () => void;
 onEdit: () => void;
 onDismiss: () => void;
}

export function ActionPanel({ understanding, onConfirm, onEdit, onDismiss }: ActionPanelProps) {
 // Universal Schema parsing
 // Extract all entities into a flat list sorted by Spatial Memory rules
 const allEntities = [
 ...understanding.entities.people.map(e => ({ ...e, group: 'Who' })),
 ...understanding.entities.dates.map(e => ({ ...e, group: 'When' })),
 ...understanding.entities.locations.map(e => ({ ...e, group: 'Where' })),
 ...understanding.entities.organizations.map(e => ({ ...e, group: 'Related' })),
 ];

 return (
 <div className="absolute bottom-full left-0 mb-4 w-72 bg-white rounded-xl shadow-elevated border border-gray-100 overflow-hidden animate-expand origin-bottom-left z-50">
 <div className="p-4">
 {/* Header */}
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-secondary font-semibold text-gray-900 capitalize">
 {understanding.type.toLowerCase()}
 </h3>
 <button 
 onClick={onDismiss}
 className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
 >
 <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
 <path d="M1 1L11 11M11 1L1 11" />
 </svg>
 </button>
 </div>

 {/* Universal Entity Rendering */}
 <div className="space-y-3 mb-5">
 {allEntities.map((entity, idx) => (
 <div key={`${entity.value}-${idx}`} className="flex flex-col">
 <span className="text-[11px] font-medium tracking-wider text-gray-400 uppercase mb-0.5">
 {entity.group}
 </span>
 <span className="text-[15px] text-gray-900 font-medium">
 {entity.value}
 </span>
 </div>
 ))}
 </div>

 {/* Universal Predictive Context (budget: 3 items) */}
 {/* These would normally come from understanding.predictions or similar */}
 <div className="pt-3 border-t border-gray-100">
 <ul className="space-y-2">
 <li className="flex items-start gap-2 text-[13px] text-gray-600">
 <span className="text-gray-400 mt-0.5">•</span>
 <span>2:00–2:45 PM Available</span>
 </li>
 <li className="flex items-start gap-2 text-[13px] text-gray-600">
 <span className="text-gray-400 mt-0.5">•</span>
 <span>Previous agenda attached</span>
 </li>
 <li className="flex items-start gap-2 text-[13px] text-gray-600">
 <span className="text-gray-400 mt-0.5">•</span>
 <span>Project Genesis</span>
 </li>
 </ul>
 </div>
 </div>

 {/* Action Footer - Immutable */}
 <div className="flex border-t border-gray-100 bg-gray-50/50">
 <button 
 onClick={onEdit}
 className="flex-1 py-3 text-button text-gray-600 hover:bg-gray-100 transition-colors"
 >
 Edit
 </button>
 <div className="w-px bg-gray-200" />
 <button 
 onClick={onConfirm}
 className="flex-1 py-3 text-button font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
 >
 Confirm
 </button>
 </div>
 </div>
 );
}
