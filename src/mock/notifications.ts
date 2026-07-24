// mock/notifications.ts

export const mockNotificationsData = {
  activities: [
    { 
      id: '1',
      iconType: 'file',
      title: 'Quotation_v2.pdf uploaded',
      subtitle: 'Sanobar shared a file in #sales',
      time: '10m ago'
    },
    { 
      id: '2',
      iconType: 'success',
      title: 'Action Item Completed',
      subtitle: 'You resolved "Update pricing model"',
      time: '1h ago'
    },
    { 
      id: '3',
      iconType: 'meeting',
      title: 'Sync Call Scheduled',
      subtitle: 'Marketing team sync starts in 30m',
      time: 'Just now'
    },
    { 
      id: '4',
      iconType: 'mention',
      title: 'Nikita mentioned you',
      subtitle: 'in #marketing: "@arshid please review"',
      time: '2h ago'
    }
  ]
};
