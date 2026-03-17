// Berechtigungs-Übersicht für alle Module
export const PERMISSIONS = {
  // Mitarbeiter
  EMPLOYEES: {
    VIEW: 'employees.view',
    CREATE: 'employees.create',
    EDIT: 'employees.edit',
    DELETE: 'employees.delete',
    EXPORT: 'employees.export',
  },
  // Dokumente
  DOCUMENTS: {
    VIEW: 'documents.view',
    CREATE: 'documents.create',
    EDIT: 'documents.edit',
    DELETE: 'documents.delete',
    DOWNLOAD: 'documents.download',
  },
  // Bekleidung
  CLOTHING: {
    VIEW: 'clothing.view',
    ORDERS_VIEW: 'clothing.orders.view',
    ORDERS_CREATE: 'clothing.orders.create',
    ORDERS_EDIT: 'clothing.orders.edit',
    ORDERS_DELETE: 'clothing.orders.delete',
    ITEMS_VIEW: 'clothing.items.view',
    ITEMS_CREATE: 'clothing.items.create',
    ITEMS_EDIT: 'clothing.items.edit',
    ITEMS_DELETE: 'clothing.items.delete',
  },
  // Planung
  PLANNING: {
    VIEW: 'planning.view',
    EDIT: 'planning.edit',
    ASSIGN: 'planning.assign',
  },
  // Kalender
  CALENDAR: {
    VIEW: 'calendar.view',
    EDIT: 'calendar.edit',
    VACATION_REQUEST: 'calendar.vacation.request',
    VACATION_APPROVE: 'calendar.vacation.approve',
  },
  // Chat
  CHAT: {
    VIEW: 'chat.view',
    SEND: 'chat.send',
    DELETE: 'chat.delete',
  },
  // Aufgaben
  TASKS: {
    VIEW: 'tasks.view',
    CREATE: 'tasks.create',
    EDIT: 'tasks.edit',
    DELETE: 'tasks.delete',
    ASSIGN: 'tasks.assign',
  },
  // Schichttausch
  SWAPS: {
    VIEW: 'swaps.view',
    REQUEST: 'swaps.request',
    APPROVE: 'swaps.approve',
  },
  // Qualifikationen
  QUALIFICATIONS: {
    VIEW: 'qualifications.view',
    CREATE: 'qualifications.create',
    EDIT: 'qualifications.edit',
    DELETE: 'qualifications.delete',
    ASSIGN: 'qualifications.assign',
  },
  // Benachrichtigungen
  NOTIFICATIONS: {
    VIEW: 'notifications.view',
    MANAGE: 'notifications.manage',
  },
  // Einstellungen
  SETTINGS: {
    VIEW: 'settings.view',
    EDIT: 'settings.edit',
  },
} as const;

// Hilfsfunktion zum Prüfen, ob eine Berechtigung existiert
export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS][keyof typeof PERMISSIONS[keyof typeof PERMISSIONS]];
