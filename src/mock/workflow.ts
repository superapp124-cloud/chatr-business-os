// mock/workflow.ts

export const mockWorkflowData = {
  workflows: [
    { id: '1', name: 'Lead Generation Flow', status: 'Running', statusColor: 'text-emerald-400' },
    { id: '2', name: 'Email Campaign', status: 'Running', statusColor: 'text-emerald-400' },
    { id: '3', name: 'Data Sync', status: 'Completed', statusColor: 'text-emerald-400' },
  ],
  reminders: [
    { id: '1', text: 'Review budget proposal', time: 'Today, 15:00', completed: false, color: 'text-orange-400' },
    { id: '2', text: 'Follow up with John', time: 'Tomorrow, 11:00', completed: false, color: 'text-blue-400' },
    { id: '3', text: 'Submit Q3 report', time: '12 Aug, 17:00', completed: false, color: 'text-sky-400' },
  ],
  suggestions: {
    title: 'You have 6 unread messages',
    subtitle: 'from high priority contacts.'
  },
  activeCall: {
    title: 'Marketing Team Sync',
    participants: 5,
    duration: '32:14'
  },
  context: {
    topPriority: {
      title: 'Review Q3 Marketing Budget',
      subtitle: 'Requested by Sanobar in #marketing'
    }
  }
};
