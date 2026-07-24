// mock/dashboard.ts

export const mockDashboardData = {
  aiInsights: {
    summary: [
      "12 unread items",
      "3 workflows failed",
      "Calendar conflict",
      "Follow up with John",
      "Resume review pending",
      "Hiring pipeline slowing",
    ],
    chartData: [
      { day: 'Mon', value: 30 },
      { day: 'Tue', value: 45 },
      { day: 'Wed', value: 40 },
      { day: 'Thu', value: 65 },
      { day: 'Fri', value: 55 },
      { day: 'Sat', value: 85 },
      { day: 'Sun', value: 100 },
    ],
    stats: {
      productivity: "24%",
      onTrack: 5,
      needAttention: 2
    }
  },
  projects: [
    { id: '1', name: 'Q3 Marketing Campaign', progress: 72, color: 'bg-emerald-500', aiRisk: 'Low' },
    { id: '2', name: 'Product Redesign', progress: 45, color: 'bg-orange-500', aiRisk: 'Medium' },
    { id: '3', name: 'Mobile App Development', progress: 60, color: 'bg-blue-500', aiRisk: 'Low' },
    { id: '4', name: 'AI Integration', progress: 30, color: 'bg-red-500', aiRisk: 'High' },
  ],
  tasks: [
    { id: '1', title: 'Review Q3 Marketing Budget', priority: 'High', deadline: 'Due today' },
    { id: '2', title: 'Update pricing model', priority: 'Medium', deadline: 'Due tomorrow' },
    { id: '3', title: 'Prepare investor deck', priority: 'High', deadline: 'Due 12 Aug' },
    { id: '4', title: 'Client call with Acme Corp', priority: 'Low', deadline: 'Due 14 Aug' },
  ]
};
