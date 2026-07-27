/**
 * Curriculum seed data — the Nabih content (Levels, Modules, Words).
 * Stored locally. CMS-ready: each item has UUID and status fields.
 */

export interface Module {
  id: string;
  title: string;
  titleAr: string;
  level: string;
  order: number;
  description: string;
  words: SeedWord[];
  grammarFocus: string | null;
}

export interface SeedWord {
  id: string;
  word: string;
  arabicTranslation: string;
  definition: string;
}

export const CURRICULUM: Module[] = [
  {
    id: 'module-greetings-a0',
    title: 'Greetings',
    titleAr: 'التحيات',
    level: 'A0',
    order: 1,
    description: 'تعلّم كيف تُحيّي الناس وتبدأ محادثة',
    grammarFocus: 'Basic Sentence Structure',
    words: [
      { id: 'w-hello', word: 'Hello', arabicTranslation: 'مرحبا', definition: 'A friendly greeting when you meet someone' },
      { id: 'w-hi', word: 'Hi', arabicTranslation: 'أهلاً', definition: 'An informal way to greet someone' },
      { id: 'w-goodbye', word: 'Goodbye', arabicTranslation: 'وداعاً', definition: 'What you say when you leave or end a conversation' },
      { id: 'w-thankyou', word: 'Thank you', arabicTranslation: 'شكراً', definition: 'What you say to show appreciation' },
      { id: 'w-please', word: 'Please', arabicTranslation: 'من فضلك', definition: 'A polite word used when making a request' },
      { id: 'w-sorry', word: 'Sorry', arabicTranslation: 'آسف', definition: 'What you say when you made a mistake or want to apologize' },
      { id: 'w-welcome', word: "You're welcome", arabicTranslation: 'عفواً', definition: 'What you say after someone thanks you' },
      { id: 'w-goodmorning', word: 'Good morning', arabicTranslation: 'صباح الخير', definition: 'A greeting used in the morning' },
      { id: 'w-goodnight', word: 'Good night', arabicTranslation: 'تصبح على خير', definition: 'A farewell said in the evening or at bedtime' },
      { id: 'w-howareyou', word: 'How are you?', arabicTranslation: 'كيف حالك؟', definition: 'A question to ask about someone\'s well-being' },
    ],
  },
  {
    id: 'module-work-a0',
    title: 'Work English',
    titleAr: 'إنجليزية العمل',
    level: 'A0',
    order: 2,
    description: 'كلمات أساسية لبيئة العمل والمكتب',
    grammarFocus: 'Present Simple',
    words: [
      { id: 'w-meeting', word: 'Meeting', arabicTranslation: 'اجتماع', definition: 'A gathering of people to discuss something' },
      { id: 'w-deadline', word: 'Deadline', arabicTranslation: 'موعد نهائي', definition: 'The time by which something must be completed' },
      { id: 'w-invoice', word: 'Invoice', arabicTranslation: 'فاتورة', definition: 'A document requesting payment for goods or services' },
      { id: 'w-colleague', word: 'Colleague', arabicTranslation: 'زميل', definition: 'A person you work with' },
      { id: 'w-schedule', word: 'Schedule', arabicTranslation: 'جدول', definition: 'A plan showing when things will happen' },
      { id: 'w-email', word: 'Email', arabicTranslation: 'بريد إلكتروني', definition: 'Electronic messages sent via the internet' },
      { id: 'w-project', word: 'Project', arabicTranslation: 'مشروع', definition: 'A planned set of activities to achieve a goal' },
      { id: 'w-presentation', word: 'Presentation', arabicTranslation: 'عرض تقديمي', definition: 'A talk or display to show information to others' },
      { id: 'w-budget', word: 'Budget', arabicTranslation: 'ميزانية', definition: 'A plan for how money will be spent' },
      { id: 'w-team', word: 'Team', arabicTranslation: 'فريق', definition: 'A group of people working together' },
    ],
  },
  {
    id: 'module-travel-a0',
    title: 'Travel',
    titleAr: 'السفر',
    level: 'A0',
    order: 3,
    description: 'كلمات تحتاجها عند السفر والتنقل',
    grammarFocus: 'Questions and Answers',
    words: [
      { id: 'w-airport', word: 'Airport', arabicTranslation: 'مطار', definition: 'A place where airplanes take off and land' },
      { id: 'w-hotel', word: 'Hotel', arabicTranslation: 'فندق', definition: 'A building where you pay to sleep and eat' },
      { id: 'w-ticket', word: 'Ticket', arabicTranslation: 'تذكرة', definition: 'A document that allows you to travel or enter somewhere' },
      { id: 'w-passport', word: 'Passport', arabicTranslation: 'جواز سفر', definition: 'An official document that proves your identity for travel' },
      { id: 'w-taxi', word: 'Taxi', arabicTranslation: 'سيارة أجرة', definition: 'A car you can hire with a driver' },
      { id: 'w-restaurant', word: 'Restaurant', arabicTranslation: 'مطعم', definition: 'A place where you pay to eat meals' },
      { id: 'w-menu', word: 'Menu', arabicTranslation: 'قائمة الطعام', definition: 'A list of food and drinks available in a restaurant' },
      { id: 'w-reservation', word: 'Reservation', arabicTranslation: 'حجز', definition: 'Booking a room, table, or seat in advance' },
      { id: 'w-checkin', word: 'Check-in', arabicTranslation: 'تسجيل الدخول', definition: 'The process of arriving and registering at a hotel or airport' },
      { id: 'w-checkout', word: 'Check-out', arabicTranslation: 'تسجيل الخروج', definition: 'The process of leaving and paying at a hotel' },
    ],
  },
];

export const GRAMMAR_PATTERNS = [
  'Past Simple',
  'Present Simple',
  'Present Continuous',
  'Subject-Verb Agreement',
  'Prepositions',
  'Articles (a/an/the)',
  'Plural Forms',
  'Question Formation',
  'Negation',
  'Comparatives',
];

export function getModuleById(id: string): Module | undefined {
  return CURRICULUM.find((m) => m.id === id);
}

export function getAllModules(): Module[] {
  return CURRICULUM;
}
