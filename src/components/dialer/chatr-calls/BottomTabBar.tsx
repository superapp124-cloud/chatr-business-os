import React from 'react';
import { Star, Clock, Users, Grid, Shield } from 'lucide-react';
import './calls.css';

interface BottomTabBarProps {
 activeTab: string;
 onTabChange: (tab: string) => void;
}

const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabChange }) => {
 const tabs = [
 { id: 'timeline', label: 'Timeline', icon: Clock },
 { id: 'favorites', label: 'Favorites', icon: Star },
 { id: 'recents', label: 'Recents', icon: Clock },
 { id: 'contacts', label: 'Contacts', icon: Users },
 { id: 'keypad', label: 'Keypad', icon: Grid },
 { id: 'shield', label: 'Chatr Shield', icon: Shield },
 ];

 return (
 <div className="ios-tab-bar glass-morphism">
 {tabs.map((tab) => {
 const Icon = tab.icon;
 return (
 <div
 key={tab.id}
 className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
 onClick={() => onTabChange(tab.id)}
 >
 <Icon className="tab-icon" strokeWidth={activeTab === tab.id ? 2.5 : 2} />
 <span className="tab-label">{tab.label}</span>
 </div>
 );
 })}
 </div>
 );
};

export default BottomTabBar;
