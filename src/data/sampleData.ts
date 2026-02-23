import {
  User,
  Child,
  TimelineEntry,
  Message,
  Conversation,
  DailyReport,
  CalendarEvent,
  Milestone,
  LearningPlan,
  Notification,
  IncidentReport,
  AttendanceRecord,
  Invoice,
} from '../types';

// ── Users ──
export const parentUser: User = {
  id: 'p1',
  name: 'Sarah Ahmed',
  role: 'parent',
  email: 'sarah@email.com',
  phone: '+1 (555) 123-4567',
};

export const caregiverUser: User = {
  id: 'c1',
  name: 'Ms. Rivera',
  role: 'caregiver',
  email: 'rivera@sunshineacademy.com',
  phone: '+1 (555) 987-6543',
};

export const adminUser: User = {
  id: 'a1',
  name: 'Director Chen',
  role: 'admin',
  email: 'chen@sunshineacademy.com',
};

// ── Children ──
export const layla: Child = {
  id: 'child1',
  firstName: 'Layla',
  lastName: 'Ahmed',
  dateOfBirth: '2023-06-15',
  classroom: 'Butterfly Room',
  allergies: ['Peanuts', 'Shellfish'],
  emergencyContacts: [
    { name: 'Sarah Ahmed', relationship: 'Mother', phone: '+1 (555) 123-4567' },
    { name: 'Omar Ahmed', relationship: 'Father', phone: '+1 (555) 234-5678' },
    { name: 'Fatima Ahmed', relationship: 'Grandmother', phone: '+1 (555) 345-6789' },
  ],
  authorizedPickups: [
    { id: 'ap1', name: 'Sarah Ahmed', relationship: 'Mother', phone: '+1 (555) 123-4567', verified: true },
    { id: 'ap2', name: 'Omar Ahmed', relationship: 'Father', phone: '+1 (555) 234-5678', verified: true },
    { id: 'ap3', name: 'Fatima Ahmed', relationship: 'Grandmother', phone: '+1 (555) 345-6789', verified: true },
  ],
  pediatrician: 'Dr. Williams',
};

export const adam: Child = {
  id: 'child9',
  firstName: 'Adam',
  lastName: 'Ahmed',
  dateOfBirth: '2021-11-03',
  classroom: 'Ladybug Room',
  allergies: [],
  emergencyContacts: [
    { name: 'Sarah Ahmed', relationship: 'Mother', phone: '+1 (555) 123-4567' },
    { name: 'Omar Ahmed', relationship: 'Father', phone: '+1 (555) 234-5678' },
  ],
  authorizedPickups: [
    { id: 'ap1', name: 'Sarah Ahmed', relationship: 'Mother', phone: '+1 (555) 123-4567', verified: true },
    { id: 'ap2', name: 'Omar Ahmed', relationship: 'Father', phone: '+1 (555) 234-5678', verified: true },
  ],
  pediatrician: 'Dr. Williams',
};

// ── Today's date helper ──
const today = new Date();
const formatTime = (h: number, m: number) => {
  const d = new Date(today);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

// ── Timeline Entries ──
export const todayTimeline: TimelineEntry[] = [
  {
    id: 't1',
    childId: 'child1',
    type: 'checkin',
    timestamp: formatTime(7, 45),
    createdBy: caregiverUser,
    title: 'Checked In',
    description: 'Layla arrived happy and ready to play! She gave Ms. Rivera a big hug.',
    mood: 'happy',
    details: { checkedInBy: 'Sarah Ahmed', method: 'QR Code' },
    reactions: [{ userId: 'p1', emoji: '❤️', timestamp: formatTime(7, 50) }],
    comments: [
      { id: 'cm1', entryId: 't1', userId: 'p1', userName: 'Sarah Ahmed', userRole: 'parent', text: 'She was so excited this morning!', timestamp: formatTime(7, 52) },
    ],
  },
  {
    id: 't2',
    childId: 'child1',
    type: 'meal',
    timestamp: formatTime(8, 15),
    createdBy: caregiverUser,
    title: 'Breakfast',
    description: 'Oatmeal with blueberries and milk. Ate most of it!',
    details: { mealType: 'breakfast', amount: 'most', items: ['Oatmeal', 'Blueberries', 'Milk'] },
    mood: 'happy',
    reactions: [{ userId: 'p1', emoji: '👍', timestamp: formatTime(8, 30) }],
    comments: [],
  },
  {
    id: 't3',
    childId: 'child1',
    type: 'activity',
    timestamp: formatTime(9, 0),
    createdBy: caregiverUser,
    title: 'Art Time — Butterfly Painting',
    description: 'Layla painted a beautiful butterfly using watercolors! She mixed purple and blue to create her own special color. She was so proud of her creation!',
    photos: ['https://picsum.photos/seed/butterfly/400/300'],
    mood: 'playful',
    reactions: [
      { userId: 'p1', emoji: '❤️', timestamp: formatTime(9, 10) },
      { userId: 'p1', emoji: '🎨', timestamp: formatTime(9, 10) },
    ],
    comments: [
      { id: 'cm2', entryId: 't3', userId: 'p1', userName: 'Sarah Ahmed', userRole: 'parent', text: 'This is beautiful! We should frame it!', timestamp: formatTime(9, 15) },
      { id: 'cm3', entryId: 't3', userId: 'c1', userName: 'Ms. Rivera', userRole: 'caregiver', text: 'She was so proud — showed it to everyone!', timestamp: formatTime(9, 20) },
    ],
  },
  {
    id: 't4',
    childId: 'child1',
    type: 'diaper',
    timestamp: formatTime(9, 45),
    createdBy: caregiverUser,
    title: 'Diaper Change',
    details: { diaperType: 'wet' },
    comments: [],
  },
  {
    id: 't5',
    childId: 'child1',
    type: 'activity',
    timestamp: formatTime(10, 0),
    createdBy: caregiverUser,
    title: 'Outdoor Play',
    description: 'Played in the sandbox and went down the slide 5 times! Layla helped her friend Zain build a sand castle.',
    photos: ['https://picsum.photos/seed/playground/400/300'],
    mood: 'playful',
    reactions: [],
    comments: [],
  },
  {
    id: 't6',
    childId: 'child1',
    type: 'meal',
    timestamp: formatTime(11, 30),
    createdBy: caregiverUser,
    title: 'Lunch',
    description: 'Mac and cheese with steamed broccoli and apple slices. Ate everything!',
    details: { mealType: 'lunch', amount: 'all', items: ['Mac and cheese', 'Steamed broccoli', 'Apple slices', 'Water'] },
    mood: 'happy',
    reactions: [],
    comments: [],
  },
  {
    id: 't7',
    childId: 'child1',
    type: 'nap',
    timestamp: formatTime(12, 15),
    createdBy: caregiverUser,
    title: 'Nap Time Started',
    description: 'Fell asleep quickly with her bunny lovey.',
    details: { status: 'sleeping', startTime: formatTime(12, 15) },
    mood: 'sleepy',
    reactions: [],
    comments: [],
  },
  {
    id: 't8',
    childId: 'child1',
    type: 'nap',
    timestamp: formatTime(14, 15),
    createdBy: caregiverUser,
    title: 'Woke Up from Nap',
    description: 'Napped for 2 hours! Woke up happy and refreshed.',
    details: { status: 'woke_up', duration: '2h 0m', startTime: formatTime(12, 15) },
    mood: 'calm',
    reactions: [],
    comments: [],
  },
  {
    id: 't9',
    childId: 'child1',
    type: 'meal',
    timestamp: formatTime(14, 30),
    createdBy: caregiverUser,
    title: 'Afternoon Snack',
    description: 'Goldfish crackers and yogurt.',
    details: { mealType: 'snack', amount: 'most', items: ['Goldfish crackers', 'Yogurt'] },
    reactions: [],
    comments: [],
  },
  {
    id: 't10',
    childId: 'child1',
    type: 'milestone',
    timestamp: formatTime(15, 0),
    createdBy: caregiverUser,
    title: 'New Milestone!',
    description: 'Layla counted to 10 all by herself during circle time! The whole class cheered for her!',
    details: { milestone: 'Counting to 10', category: 'cognitive' },
    mood: 'happy',
    photos: ['https://picsum.photos/seed/counting/400/300'],
    reactions: [
      { userId: 'p1', emoji: '🎉', timestamp: formatTime(15, 10) },
      { userId: 'p1', emoji: '❤️', timestamp: formatTime(15, 10) },
    ],
    comments: [
      { id: 'cm4', entryId: 't10', userId: 'p1', userName: 'Sarah Ahmed', userRole: 'parent', text: 'We are SO proud of her!! 🎉', timestamp: formatTime(15, 12) },
    ],
  },
  {
    id: 't11',
    childId: 'child1',
    type: 'activity',
    timestamp: formatTime(15, 30),
    createdBy: caregiverUser,
    title: 'Story Time',
    description: 'Read "The Very Hungry Caterpillar." Layla loves naming all the foods the caterpillar eats!',
    mood: 'calm',
    reactions: [],
    comments: [],
  },
  {
    id: 't12',
    childId: 'child1',
    type: 'photo',
    timestamp: formatTime(16, 0),
    createdBy: caregiverUser,
    title: 'Fun Moment!',
    description: 'Layla and her friends playing dress-up in the dramatic play area.',
    photos: ['https://picsum.photos/seed/dressup/400/300'],
    mood: 'playful',
    reactions: [],
    comments: [],
  },
];

// ── Messages ──
export const sampleMessages: Message[] = [
  {
    id: 'm1', conversationId: 'conv1', senderId: 'c1', senderName: 'Ms. Rivera', senderRole: 'caregiver',
    text: 'Good morning! Layla arrived in great spirits today. She ran straight to the art table! 🎨',
    timestamp: formatTime(7, 50), read: true,
  },
  {
    id: 'm2', conversationId: 'conv1', senderId: 'p1', senderName: 'Sarah Ahmed', senderRole: 'parent',
    text: "That's wonderful! She was talking about painting all morning. Thank you for letting me know! 💕",
    timestamp: formatTime(8, 5), read: true,
  },
  {
    id: 'm3', conversationId: 'conv1', senderId: 'c1', senderName: 'Ms. Rivera', senderRole: 'caregiver',
    text: "She painted the most beautiful butterfly! I'll share the photo in the timeline. Also, she ate almost all of her breakfast today.",
    timestamp: formatTime(9, 15), read: true,
  },
  {
    id: 'm4', conversationId: 'conv1', senderId: 'p1', senderName: 'Sarah Ahmed', senderRole: 'parent',
    text: "Oh amazing! We've been practicing colors at home so I'm glad she's using them. How is she getting along with the other kids?",
    timestamp: formatTime(9, 30), read: true,
  },
  {
    id: 'm5', conversationId: 'conv1', senderId: 'c1', senderName: 'Ms. Rivera', senderRole: 'caregiver',
    text: "She's doing great socially! She helped her friend Zain build a sandcastle during outdoor play. She's really learning to share and cooperate. You should be so proud! 🏰",
    timestamp: formatTime(10, 20), read: true,
  },
  {
    id: 'm6', conversationId: 'conv1', senderId: 'c1', senderName: 'Ms. Rivera', senderRole: 'caregiver',
    text: "BIG news! 🌟 Layla counted all the way to 10 during circle time! The whole class clapped for her. She was beaming!",
    timestamp: formatTime(15, 5), read: false,
  },
  {
    id: 'm7', conversationId: 'conv1', senderId: 'c1', senderName: 'Ms. Rivera', senderRole: 'caregiver',
    text: "She's having a great afternoon playing dress-up with friends. Pickup is at the usual time. See you soon!",
    timestamp: formatTime(16, 5), read: false,
  },
  // Admin conversation messages
  {
    id: 'ma1', conversationId: 'conv2', senderId: 'a1', senderName: 'Director Chen', senderRole: 'admin',
    text: "Reminder: Parent-Teacher conferences are next Tuesday. Please sign up for a time slot through the calendar.",
    timestamp: formatTime(9, 0), read: true,
  },
  {
    id: 'ma2', conversationId: 'conv2', senderId: 'p1', senderName: 'Sarah Ahmed', senderRole: 'parent',
    text: "Thanks for the reminder! I've signed up for 3:00 PM.",
    timestamp: formatTime(9, 15), read: true,
  },
  {
    id: 'ma3', conversationId: 'conv2', senderId: 'a1', senderName: 'Director Chen', senderRole: 'admin',
    text: "Perfect, you're confirmed for 3:00 PM. Also, just a heads up — we're introducing a new organic menu starting March 1st. Details will be sent via email.",
    timestamp: formatTime(10, 0), read: false,
  },
  // Group announcement
  {
    id: 'mg1', conversationId: 'conv3', senderId: 'a1', senderName: 'Director Chen', senderRole: 'admin',
    text: "📢 Attention all parents: Spring Festival is on March 20th! Sign up to volunteer in the front office. We need help with face painting, food booths, and games. 🎉",
    timestamp: formatTime(8, 0), read: true,
  },
  {
    id: 'mg2', conversationId: 'conv3', senderId: 'p1', senderName: 'Sarah Ahmed', senderRole: 'parent',
    text: "We'd love to help with the face painting booth!",
    timestamp: formatTime(8, 30), read: true,
  },
];

export const sampleConversations: Conversation[] = [
  {
    id: 'conv1',
    participants: [parentUser, caregiverUser],
    childId: 'child1',
    lastMessage: sampleMessages[6], // m7
    unreadCount: 2,
    type: 'direct',
  },
  {
    id: 'conv2',
    participants: [parentUser, adminUser],
    lastMessage: sampleMessages[9], // ma3
    unreadCount: 1,
    type: 'direct',
  },
  {
    id: 'conv3',
    participants: [parentUser, adminUser, caregiverUser],
    lastMessage: sampleMessages[11], // mg2
    unreadCount: 0,
    type: 'announcement',
    title: 'Sunshine Academy Announcements',
  },
];

// ── Notifications ──
export const sampleNotifications: Notification[] = [
  {
    id: 'n1', type: 'activity', title: 'New Photo Added',
    body: "Ms. Rivera shared a photo of Layla's butterfly painting",
    timestamp: formatTime(9, 5), read: false, childId: 'child1', icon: '📸',
  },
  {
    id: 'n2', type: 'milestone', title: 'Milestone Achieved!',
    body: 'Layla counted to 10 all by herself!',
    timestamp: formatTime(15, 0), read: false, childId: 'child1', icon: '🌟',
  },
  {
    id: 'n3', type: 'message', title: 'New Message from Ms. Rivera',
    body: "She's having a great afternoon playing dress-up...",
    timestamp: formatTime(16, 5), read: false, icon: '💬',
  },
  {
    id: 'n4', type: 'reminder', title: 'Parent-Teacher Conference',
    body: 'Upcoming on Feb 24 at 3:00 PM with Ms. Rivera',
    timestamp: formatTime(8, 0), read: true, icon: '📅',
  },
  {
    id: 'n5', type: 'announcement', title: 'New Menu Starting March 1st',
    body: 'Sunshine Academy is introducing an organic menu for all classrooms',
    timestamp: formatTime(10, 0), read: true, icon: '📢',
  },
  {
    id: 'n6', type: 'activity', title: 'Daily Report Ready',
    body: "Layla's daily report for today is available",
    timestamp: formatTime(16, 30), read: false, childId: 'child1', icon: '📋',
  },
  {
    id: 'n7', type: 'alert', title: 'Allergy Reminder',
    body: "Remember: Layla has allergies to Peanuts, Shellfish",
    timestamp: formatTime(7, 30), read: true, childId: 'child1', icon: '⚠️',
  },
];

// ── Invoices ──
export const sampleInvoices: Invoice[] = [
  {
    id: 'inv1', childId: 'child1', description: 'February 2026 Tuition',
    amount: 1250, dueDate: '2026-02-28', status: 'pending',
    items: [
      { description: 'Monthly Tuition — Full Day', amount: 1100 },
      { description: 'Lunch Program', amount: 100 },
      { description: 'Art Supplies Fee', amount: 50 },
    ],
  },
  {
    id: 'inv2', childId: 'child1', description: 'January 2026 Tuition',
    amount: 1250, dueDate: '2026-01-31', paidDate: '2026-01-28', status: 'paid',
    items: [
      { description: 'Monthly Tuition — Full Day', amount: 1100 },
      { description: 'Lunch Program', amount: 100 },
      { description: 'Art Supplies Fee', amount: 50 },
    ],
  },
  {
    id: 'inv3', childId: 'child1', description: 'Registration Fee',
    amount: 150, dueDate: '2026-01-05', paidDate: '2026-01-03', status: 'paid',
    items: [
      { description: 'Annual Registration Fee', amount: 150 },
    ],
  },
];

// ── Attendance ──
export const sampleAttendance: AttendanceRecord[] = [
  { childId: 'child1', childName: 'Layla Ahmed', date: today.toISOString().split('T')[0], checkInTime: formatTime(7, 45), status: 'present' },
  { childId: 'child2', childName: 'Zain Malik', date: today.toISOString().split('T')[0], checkInTime: formatTime(8, 0), status: 'present' },
  { childId: 'child3', childName: 'Emma Lopez', date: today.toISOString().split('T')[0], checkInTime: formatTime(8, 10), status: 'present' },
  { childId: 'child4', childName: 'Noah Kim', date: today.toISOString().split('T')[0], checkInTime: formatTime(8, 30), status: 'late', note: 'Doctor appointment this morning' },
  { childId: 'child5', childName: 'Aria Singh', date: today.toISOString().split('T')[0], status: 'excused', note: 'Family vacation' },
  { childId: 'child6', childName: 'Liam Brown', date: today.toISOString().split('T')[0], checkInTime: formatTime(7, 55), status: 'present' },
  { childId: 'child7', childName: 'Mia Chen', date: today.toISOString().split('T')[0], checkInTime: formatTime(8, 5), status: 'present' },
  { childId: 'child8', childName: 'Ethan Davis', date: today.toISOString().split('T')[0], status: 'absent' },
];

// ── Incident Reports ──
export const sampleIncidents: IncidentReport[] = [
  {
    id: 'ir1', childId: 'child2', childName: 'Zain Malik',
    reportedBy: caregiverUser,
    timestamp: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2, 10, 30).toISOString(),
    type: 'fall', severity: 'minor', location: 'Outdoor Playground',
    description: 'Zain tripped while running near the sandbox and scraped his knee lightly.',
    actionTaken: 'Cleaned the scrape with antiseptic wipe, applied a bandaid. Comforted and returned to play within 5 minutes.',
    parentNotified: true, witnessName: 'Ms. Rivera',
  },
];

// ── Daily Report ──
export const todayReport: DailyReport = {
  id: 'dr1',
  childId: 'child1',
  date: today.toISOString().split('T')[0],
  narrative:
    "What a wonderful day for Layla! She started her morning at Sunshine Academy with a big smile and a warm hug for Ms. Rivera. At the art table, Layla created a stunning butterfly painting, mixing purple and blue to invent her very own color — she was bursting with pride!\n\nDuring outdoor play, she showed great teamwork by helping her friend Zain build a sandcastle. Lunch was a hit — she finished every bite of mac and cheese with broccoli.\n\nThe highlight of the day? Layla counted all the way to 10 during circle time! The whole Butterfly Room cheered for her. She napped soundly for 2 hours and spent the afternoon playing dress-up and enjoying story time.\n\nLayla is growing into such a confident, creative, and kind little person. We can't wait to see what tomorrow brings! 🦋",
  summary: {
    meals: 3,
    naps: 1,
    napDuration: '2h 0m',
    diaperChanges: 1,
    activities: 4,
    photos: 4,
    mood: 'happy',
  },
  highlights: [
    'Painted a beautiful butterfly with watercolors',
    'Counted to 10 all by herself!',
    'Helped a friend build a sandcastle',
    'Ate all of her lunch',
  ],
  entries: todayTimeline,
  caregiverNote:
    "Layla had an exceptional day! She's really blossoming in the Butterfly Room. Her counting skills are improving rapidly, and she's becoming such a kind friend to her classmates. Keep up the great work at home! 💝 — Ms. Rivera",
};

// ── Calendar Events ──
export const calendarEvents: CalendarEvent[] = [
  {
    id: 'ce1', title: 'Parent-Teacher Conference', date: '2026-02-24', time: '3:00 PM',
    type: 'conference', description: 'Discuss Layla\'s progress with Ms. Rivera', location: 'Butterfly Room',
  },
  { id: 'ce2', title: "Presidents' Day — Center Closed", date: '2026-02-16', type: 'closure' },
  {
    id: 'ce3', title: 'Spring Photos', date: '2026-03-05', time: '9:00 AM',
    type: 'event', description: 'Professional spring photos for all children',
  },
  { id: 'ce4', title: "Layla's Birthday! 🎂", date: '2026-06-15', type: 'birthday' },
  {
    id: 'ce5', title: 'Vaccination Reminder — DTaP Booster', date: '2026-03-15',
    type: 'vaccination', description: 'Schedule with Dr. Williams',
  },
  {
    id: 'ce6', title: 'Spring Festival', date: '2026-03-20', time: '10:00 AM',
    type: 'event', description: 'Annual spring festival with games, food, and performances', location: 'Sunshine Academy Courtyard',
  },
];

// ── Milestones ──
export const milestones: Milestone[] = [
  { id: 'ms1', childId: 'child1', title: 'Counts to 10', category: 'cognitive', ageRange: '24-36 months', achievedDate: today.toISOString().split('T')[0], notes: 'Counted independently during circle time!' },
  { id: 'ms2', childId: 'child1', title: 'Uses 2-3 word sentences', category: 'language', ageRange: '24-30 months', achievedDate: '2025-12-01' },
  { id: 'ms3', childId: 'child1', title: 'Runs confidently', category: 'motor', ageRange: '18-24 months', achievedDate: '2025-08-15' },
  { id: 'ms4', childId: 'child1', title: 'Plays alongside other children', category: 'social', ageRange: '24-36 months', achievedDate: '2026-01-10' },
  { id: 'ms5', childId: 'child1', title: 'Washes hands independently', category: 'self_care', ageRange: '24-36 months', achievedDate: '2026-01-20' },
  { id: 'ms6', childId: 'child1', title: 'Sorts by shape and color', category: 'cognitive', ageRange: '30-36 months' },
  { id: 'ms7', childId: 'child1', title: 'Tells simple stories', category: 'language', ageRange: '30-36 months' },
  { id: 'ms8', childId: 'child1', title: 'Pedals a tricycle', category: 'motor', ageRange: '30-36 months' },
  { id: 'ms9', childId: 'child1', title: 'Takes turns with others', category: 'social', ageRange: '30-36 months' },
];

// ── Learning Plans ──
export const learningPlans: LearningPlan[] = [
  {
    id: 'lp1',
    title: 'Colors & Numbers Week',
    week: 'Feb 17 - Feb 21',
    goals: ['Recognize and name primary colors', 'Count objects up to 10', 'Sort items by color'],
    activities: [
      { name: 'Rainbow Painting', description: 'Children will paint rainbows, naming each color as they go', completed: true },
      { name: 'Counting Bears', description: 'Sort and count colorful bears into groups', completed: true },
      { name: 'Color Scavenger Hunt', description: 'Find items around the classroom matching specific colors', completed: false },
      { name: 'Number Songs', description: 'Sing counting songs during circle time', completed: true },
    ],
    caregiverId: 'c1',
  },
];
