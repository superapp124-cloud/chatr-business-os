import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TenantContext } from '../types.js';
import jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long'; // Mock secret for dev

export function getTenantSupabaseClient(tenant: TenantContext): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase URL and Anon Key must be provided in environment variables');
  }

  // Create a custom JWT containing the tenant_id in the app_metadata/claims
  // Supabase RLS policies can extract this using current_setting('request.jwt.claims')::json->>'tenant_id'
  const payload = {
    role: 'authenticated', // Use authenticated role for RLS
    aud: 'authenticated',
    sub: tenant.userId,
    tenant_id: tenant.tenantId,
    org_id: tenant.organizationId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiry
  };

  const token = jwt.sign(payload, SUPABASE_JWT_SECRET);

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

export function getSystemSupabaseClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !serviceKey) {
    throw new Error('Supabase URL and Service Role Key must be provided in environment variables for system client');
  }

  return createClient(SUPABASE_URL, serviceKey);
}
