import { create } from 'zustand';

export type BusinessRole = 
  | 'Owner' 
  | 'Administrator' 
  | 'Manager' 
  | 'Sales' 
  | 'Support' 
  | 'Finance' 
  | 'Receptionist';

export type Permission = 
  | 'view_crm' 
  | 'edit_crm' 
  | 'manage_users' 
  | 'view_analytics' 
  | 'manage_billing' 
  | 'handle_inbox' 
  | 'configure_ai'
  | 'manage_campaigns'
  | 'view_reports';

const rolePermissions: Record<BusinessRole, Permission[]> = {
  Owner: ['view_crm', 'edit_crm', 'manage_users', 'view_analytics', 'manage_billing', 'handle_inbox', 'configure_ai', 'manage_campaigns', 'view_reports'],
  Administrator: ['view_crm', 'edit_crm', 'manage_users', 'view_analytics', 'handle_inbox', 'configure_ai', 'manage_campaigns', 'view_reports'],
  Manager: ['view_crm', 'edit_crm', 'view_analytics', 'handle_inbox', 'manage_campaigns', 'view_reports'],
  Sales: ['view_crm', 'edit_crm', 'handle_inbox'],
  Support: ['view_crm', 'handle_inbox'],
  Finance: ['view_reports', 'manage_billing'],
  Receptionist: ['handle_inbox', 'view_crm']
};

interface PermissionsState {
  currentRole: BusinessRole | null;
  setRole: (role: BusinessRole) => void;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (roles: BusinessRole[]) => boolean;
}

export const usePermissions = create<PermissionsState>((set, get) => ({
  currentRole: 'Owner', // Defaulting to Owner for development purposes
  setRole: (role) => set({ currentRole: role }),
  
  hasPermission: (permission) => {
    const { currentRole } = get();
    if (!currentRole) return false;
    
    const permissions = rolePermissions[currentRole] || [];
    return permissions.includes(permission);
  },
  
  hasRole: (allowedRoles) => {
    const { currentRole } = get();
    if (!currentRole) return false;
    
    return allowedRoles.includes(currentRole);
  }
}));
