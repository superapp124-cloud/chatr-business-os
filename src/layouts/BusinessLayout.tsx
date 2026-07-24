import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Inbox, Users, Link as LinkIcon, Building2, LayoutDashboard, Settings, Workflow, PhoneCall, Store, Terminal, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

import { CommunicationPulse } from '@/components/desktop/CommunicationPulse';

export const BusinessLayout = () => {
 const location = useLocation();

 const navigation = [
 { name: 'Dashboard', href: '/desktop/pro/business/dashboard', icon: LayoutDashboard },
 { name: 'Team Inbox', href: '/desktop/pro/business/inbox', icon: Inbox },
 { name: 'Customers', href: '/desktop/pro/business/crm', icon: Users },
 { name: 'Automations', href: '/desktop/pro/business/automations', icon: Workflow },
 { name: 'Campaign Studio', href: '/desktop/pro/business/broadcasts', icon: Megaphone },
 { name: 'Business Phone', href: '/desktop/pro/business/phone', icon: PhoneCall },
 { name: 'App Store', href: '/desktop/pro/business/app-store', icon: Store },
 { name: 'Developer Hub', href: '/desktop/pro/business/developer', icon: Terminal },
 { name: 'Settings', href: '/desktop/pro/business/settings', icon: Settings },
 ];

 return (
 <div className="flex h-full w-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
 {/* Sidebar Navigation */}
 <div className="w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col">
 {/* Brand Header */}
 <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
 <div className="flex items-center gap-2 text-primary font-semibold text-section">
 <Building2 className="w-6 h-6" />
 CHATR Business
 </div>
 </div>
 <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
 {navigation.map((item) => {
 const isActive = location.pathname.startsWith(item.href);
 return (
 <Link
 key={item.name}
 to={item.href}
 className={cn(
 "flex items-center gap-3 px-3 py-2.5 rounded-md text-secondary font-medium transition-colors",
 isActive 
 ? "bg-primary/10 text-primary" 
 : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
 )}
 >
 <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-gray-400")} />
 {item.name}
 </Link>
 );
 })}
 </nav>

 {/* User / Workspace Switcher Footer */}
 <div className="p-4 border-t border-gray-200 dark:border-gray-800">
 <Link 
 to="/workspace-selector"
 className="flex items-center justify-center w-full px-4 py-2 text-secondary font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-950 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
 >
 Switch Workspace
 </Link>
 </div>
 </div>

 <main className="flex-1 overflow-y-auto">
 <Outlet />
 </main>
 
 {/* Shared Desktop Calling UI */}
 <CommunicationPulse />
 </div>

 );
};
