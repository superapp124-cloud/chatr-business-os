import React, { useState, useEffect } from 'react';
import { GoalHistoryService, SavedIntentTemplate, GoalHistoryRecord } from '../../core/product/goal-history-service';
import './inbox.css';

interface UniversalIntentInboxProps {
 onIntentSelected: (intentText: string) => void;
}

export const UniversalIntentInbox: React.FC<UniversalIntentInboxProps> = ({ onIntentSelected }) => {
 const [templates, setTemplates] = useState<SavedIntentTemplate[]>([]);
 const [history, setHistory] = useState<GoalHistoryRecord[]>([]);

 useEffect(() => {
 setTemplates(GoalHistoryService.getSavedTemplates());
 setHistory(GoalHistoryService.getHistory());
 }, []);

 return (
 <div className="inbox-container">
 <div className="inbox-header">
 <h2 className="inbox-title">Universal Intent Inbox</h2>
 </div>

 {/* Repeat / Saved Templates section */}
 {templates.length > 0 && (
 <div className="inbox-section">
 <h3 className="inbox-section-title">Repeat</h3>
 <div className="inbox-templates-scroll">
 {templates.map(tpl => (
 <div 
 key={tpl.id} 
 className="inbox-template-card" 
 onClick={() => onIntentSelected(tpl.intent)}
 role="button"
 tabIndex={0}
 >
 <div className="template-icon" style={{ backgroundColor: tpl.color + '20', color: tpl.color }}>
 {tpl.icon || '🔁'}
 </div>
 <div className="template-info">
 <div className="template-title">{tpl.title}</div>
 <div className="template-subtitle">One tap execution</div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* ACTIVE GOALS */}
 <div className="inbox-section">
 <h3 className="inbox-section-title">Active Goals</h3>
 
 <div className="inbox-goal-card active-goal">
 <div className="goal-status-indicator" style={{ backgroundColor: '#10b981' }}></div>
 <div className="goal-content">
 <div className="goal-title">Chicken Biryani</div>
 <div className="goal-detail" style={{ color: '#10b981' }}>Arriving in 11 min</div>
 </div>
 </div>

 <div className="inbox-goal-card active-goal">
 <div className="goal-status-indicator" style={{ backgroundColor: '#f59e0b' }}></div>
 <div className="goal-content">
 <div className="goal-title">Train Ticket</div>
 <div className="goal-detail" style={{ color: '#f59e0b' }}>Tatkal opens in 8 min</div>
 </div>
 </div>

 <div className="inbox-goal-card active-goal">
 <div className="goal-status-indicator" style={{ backgroundColor: '#3b82f6' }}></div>
 <div className="goal-content">
 <div className="goal-title">Electricity Bill</div>
 <div className="goal-detail" style={{ color: '#3b82f6' }}>Due tomorrow</div>
 </div>
 </div>
 </div>

 {/* DONE GOALS */}
 <div className="inbox-section">
 <h3 className="inbox-section-title">Done</h3>
 {history.map(item => (
 <div key={item.id} className="inbox-goal-card done-goal">
 <div className="goal-status-indicator" style={{ backgroundColor: '#55556a' }}></div>
 <div className="goal-content">
 <div className="goal-title">{item.intent}</div>
 <div className="goal-detail">{item.details}</div>
 </div>
 <div className="goal-meta">{item.provider}</div>
 </div>
 ))}
 </div>
 </div>
 );
};
