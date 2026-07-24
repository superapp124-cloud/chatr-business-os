import React from 'react';
import { ShieldAlert } from 'lucide-react';

export interface RoleGuardProps {
 requiredRole: 'admin' | 'manager' | 'employee' | 'candidate' | 'client';
 userRole?: string;
 children: React.ReactNode;
 fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ 
 requiredRole, 
 userRole = 'employee', // Default to lowest internal tier if none provided (for Phase 4 testing)
 children, 
 fallback 
}) => {
 
 const roleHierarchy = {
 'admin': 100,
 'manager': 80,
 'employee': 50,
 'client': 20,
 'candidate': 10
 };

 const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
 const requiredLevel = roleHierarchy[requiredRole] || 100;

 const hasAccess = userLevel >= requiredLevel;

 if (hasAccess) {
 return <>{children}</>;
 }

 if (fallback) {
 return <>{fallback}</>;
 }

 return (
 <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 border border-slate-200 rounded-lg">
 <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
 <ShieldAlert className="w-6 h-6 text-red-500" />
 </div>
 <h3 className="text-section font-bold text-slate-800">Access Denied</h3>
 <p className="text-secondary text-slate-500 mt-2 max-w-md">
 You do not have the required permissions ({requiredRole}) to view this workflow step. 
 Please contact your workspace administrator if you believe this is an error.
 </p>
 </div>
 );
};
