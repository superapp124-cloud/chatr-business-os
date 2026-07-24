// mock/calendar.ts

export const mockCalendarData = {
  schedule: [
    { 
      id: '1', 
      time: '15:00', 
      title: 'Team Standup', 
      subtitle: 'Daily sync meeting',
      participants: ['a', 'b', 'c', 'd'], 
      extra: '+3',
      color: 'border-blue-500'
    },
    { 
      id: '2', 
      time: '16:00', 
      title: 'Client Presentation', 
      subtitle: 'Q3 Campaign Review',
      participants: ['e', 'f', 'g'], 
      extra: '+2',
      color: 'border-purple-500'
    },
    { 
      id: '3', 
      time: '17:30', 
      title: 'Product Review', 
      subtitle: 'Mobile App v2.0',
      participants: ['h', 'i', 'j', 'k', 'l'], 
      extra: '+4',
      color: 'border-orange-500'
    },
    { 
      id: '4', 
      time: 'Tomorrow', 
      title: 'Sprint Planning', 
      subtitle: 'Planning for Sprint 24',
      participants: ['m', 'n', 'o'], 
      extra: '+6',
      color: 'border-emerald-500'
    }
  ]
};
