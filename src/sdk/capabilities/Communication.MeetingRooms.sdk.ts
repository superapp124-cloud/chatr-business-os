/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Meeting Room Booking (Communication.MeetingRooms)
 */

import { ICapabilityManifest } from '../types';

export const CommunicationMeetingRoomsSDK: ICapabilityManifest = {
  id: 'Communication.MeetingRooms',
  name: 'Meeting Room Booking',
  description: 'Conference room booking with equipment management, recurring reservations, and usage analytics.',
  department: 'Communication',
  category: 'Communication',
  version: '1.1.0',
  maturity: 'L3',
  icon: '🏠',
  rating: 4.3,
  installs: 7200,
  tags: ["meeting-rooms","booking","office"],

  objects: [
    {
      name: 'RoomBooking',
      pluralName: 'Room Bookings',
      icon: '🏠',
      titleField: 'Title',
      statusField: '',
      fields: [
        {
                name: "Title",
                label: "Meeting Title",
                type: "string",
                required: true,
                searchable: true,
                width: "full"
        },
        {
                name: "Room",
                label: "Room",
                type: "string",
                required: true,
                filterable: true,
                width: "half"
        },
        {
                name: "StartTime",
                label: "Start Time",
                type: "date",
                required: true,
                sortable: true,
                width: "half"
        },
        {
                name: "Organizer",
                label: "Organizer",
                type: "user",
                filterable: true,
                width: "half"
        },
        {
                name: "Attendees",
                label: "No. of Attendees",
                type: "number",
                width: "half"
        }
],
      relations: [],
      features: { comments: true, timeline: true, attachments: true }
    }
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'roombooking', label: 'Room Bookings', icon: '🏠', type: 'grid', object: 'RoomBooking' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Meeting Room Booking AI',
    skills: []
  },
  
  // ABI v1.0: Intelligence & Execution
  stateMachines: [],
  policies: [],
  agents: [],
  tools: [],
  workflows: [],
  automations: [],
  notifications: [],
  permissions: {},
  search: { objects: [] },
  settings: [],
  integrations: [],
  seed: { objects: [] }
};
