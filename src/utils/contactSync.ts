import { Contacts } from '@capacitor-community/contacts';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { hashPhoneNumber, normalizeToInternational } from './phoneHashUtil';
import { isUsefulCallerName } from './callerIdentityResolver';

export interface DeviceContact {
  name: string;
  phone: string;
  email?: string;
}

/**
 * Get device contacts (Telegram-style - native device contacts only)
 * Works on Android via ContactsContract and iOS via CNContactStore
 */
export const getDeviceContacts = async (): Promise<DeviceContact[]> => {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Device contacts only available on mobile');
  }

  // Request permission (READ_CONTACTS on Android, CNContactStore on iOS)
  const permission = await Contacts.requestPermissions();
  
  if (permission.contacts !== 'granted') {
    throw new Error('Contacts permission denied');
  }

  // Fetch all device contacts
  const result = await Contacts.getContacts({
    projection: {
      name: true,
      phones: true,
      emails: true,
    }
  });

  if (!result.contacts || result.contacts.length === 0) {
    return [];
  }

  // Extract every phone number per contact. Many phonebooks store WhatsApp,
  // work, and mobile numbers on one card; syncing only phones[0] drops names.
  return result.contacts
    .flatMap(contact => {
      const name = contact.name?.display || contact.name?.given || contact.name?.family || 'Unknown';
      const email = contact.emails?.[0]?.address;
      return (contact.phones || []).map(phone => ({
        name,
        phone: phone.number || '',
        email,
      }));
    })
    .filter(c => c.phone); // Only contacts with phone numbers
};

// Using canonical normalizer imported from phoneHashUtil

/**
 * Sync device contacts with Supabase (Telegram-style)
 * Reads native device contacts and syncs to contacts table
 */
export const syncContacts = async (userId: string): Promise<number> => {
  // Get device contacts
  const deviceContacts = await getDeviceContacts();
  
  if (deviceContacts.length === 0) {
    console.log('No contacts found on device');
    return 0;
  }

  // Prepare contacts for sync and dedupe by normalized number.
  const deduped = new Map<string, DeviceContact>();
  for (const contact of deviceContacts) {
    const phone = normalizeToInternational(contact.phone);
    if (!phone) continue;

    const previous = deduped.get(phone);
    const name = isUsefulCallerName(contact.name, phone) ? contact.name.trim() : previous?.name || 'Unknown';
    deduped.set(phone, {
      name,
      phone,
      email: contact.email || previous?.email,
    });
  }

  const contactList = await Promise.all(
    Array.from(deduped.values()).map(async (contact) => ({
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      phone_hash: await hashPhoneNumber(contact.phone),
    }))
  );

  if (contactList.length === 0) {
    console.log('No valid phone numbers found in contacts');
    return 0;
  }

  // Call RPC function to sync contacts
  const { error } = await supabase.rpc('sync_user_contacts', {
    user_uuid: userId,
    contact_list: contactList,
  });

  if (error) {
    console.error('Contact sync RPC error:', error);
    throw new Error(error.message || 'Contact sync failed');
  }

  // Feed the Truecaller-style identity graph. This is privacy-preserving:
  // lookup uses hashed_number, while phone_number is retained for the reporter's
  // own rows and can be omitted by backend policies later without breaking hash lookup.
  const observations = contactList
    .filter(contact => isUsefulCallerName(contact.name, contact.phone))
    .map(contact => ({
      reporter_id: userId,
      phone_number: contact.phone,
      hashed_number: contact.phone_hash,
      observed_name: contact.name,
      source: 'phonebook',
      confidence: 85,
      updated_at: new Date().toISOString(),
    }));

  if (observations.length > 0) {
    const { error: observationsError } = await (supabase as any)
      .from('caller_identity_observations')
      .upsert(observations, {
        onConflict: 'reporter_id,hashed_number,source',
      });

    if (observationsError) {
      console.warn('Caller identity observations sync failed:', observationsError);
    }
  }

  return contactList.length;
};

/**
 * Check if contacts permission is granted
 */
export const checkContactsPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  
  try {
    const permission = await Contacts.checkPermissions();
    return permission.contacts === 'granted';
  } catch {
    return false;
  }
};
