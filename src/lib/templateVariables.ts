/**
 * Ersetzt {{variable}}-Platzhalter im Template-HTML durch echte Mitarbeiterdaten.
 */

type EmployeeForTemplate = {
  firstName: string;
  lastName: string;
  employeeNumber: string;
  dateOfBirth?: Date | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  zipCode?: string | null;
  city?: string | null;
  startDate?: Date | null;
  hourlyWage?: unknown;
  vacationDays?: number | null;
  socialSecurityNumber?: string | null;
  taxId?: string | null;
  healthInsurance?: string | null;
  department?: { name: string } | null;
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return '[nicht angegeben]';
  const d = new Date(date);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatToday(): string {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function val(v: string | null | undefined): string {
  return v?.trim() || '[nicht angegeben]';
}

export function buildVariableMap(employee: EmployeeForTemplate): Record<string, string> {
  return {
    vorname: val(employee.firstName),
    nachname: val(employee.lastName),
    vollname: `${employee.firstName} ${employee.lastName}`.trim(),
    mitarbeiternummer: val(employee.employeeNumber),
    geburtsdatum: formatDate(employee.dateOfBirth),
    position: val(employee.position),
    abteilung: val(employee.department?.name),
    email: val(employee.email),
    telefon: val(employee.phone),
    strasse: val(employee.street),
    plz: val(employee.zipCode),
    stadt: val(employee.city),
    startdatum: formatDate(employee.startDate),
    stundenlohn: employee.hourlyWage != null ? String(employee.hourlyWage) : '[nicht angegeben]',
    urlaubstage: employee.vacationDays != null ? String(employee.vacationDays) : '[nicht angegeben]',
    datum: formatToday(),
    sozialversicherungsnummer: val(employee.socialSecurityNumber),
    steueridentifikationsnummer: val(employee.taxId),
    krankenversicherung: val(employee.healthInsurance),
  };
}

export function substituteVariables(html: string, variables: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

/** Alle verfügbaren Variablen mit Label für die UI */
export const AVAILABLE_VARIABLES: { key: string; label: string }[] = [
  { key: 'vorname', label: 'Vorname' },
  { key: 'nachname', label: 'Nachname' },
  { key: 'vollname', label: 'Vollständiger Name' },
  { key: 'mitarbeiternummer', label: 'Mitarbeiternummer' },
  { key: 'geburtsdatum', label: 'Geburtsdatum' },
  { key: 'position', label: 'Position' },
  { key: 'abteilung', label: 'Abteilung' },
  { key: 'startdatum', label: 'Eintrittsdatum' },
  { key: 'stundenlohn', label: 'Stundenlohn' },
  { key: 'urlaubstage', label: 'Urlaubstage' },
  { key: 'datum', label: 'Heutiges Datum' },
  { key: 'strasse', label: 'Straße' },
  { key: 'plz', label: 'PLZ' },
  { key: 'stadt', label: 'Stadt' },
  { key: 'email', label: 'E-Mail' },
  { key: 'telefon', label: 'Telefon' },
  { key: 'sozialversicherungsnummer', label: 'SV-Nummer' },
  { key: 'steueridentifikationsnummer', label: 'Steuer-ID' },
  { key: 'krankenversicherung', label: 'Krankenversicherung' },
];
