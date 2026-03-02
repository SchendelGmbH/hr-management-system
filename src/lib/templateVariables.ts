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
  fixedTermEndDate?: Date | null;
  probationEndDate?: Date | null;
  hourlyWage?: unknown;
  overtariffSupplement?: unknown;
  payGrade?: { name: string; tariffWage?: unknown } | null;
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
    befristet_bis: formatDate(employee.fixedTermEndDate),
    probezeit_bis: formatDate(employee.probationEndDate),
    stundenlohn: employee.hourlyWage != null ? String(employee.hourlyWage) : '[nicht angegeben]',
    lohngruppe: val(employee.payGrade?.name),
    tariflohn: employee.payGrade?.tariffWage != null ? String(employee.payGrade.tariffWage) : '[nicht angegeben]',
    uebertariflicher_zuschlag: employee.overtariffSupplement != null ? String(employee.overtariffSupplement) : '[nicht angegeben]',
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

/**
 * Erkennt alle {{variable}}-Platzhalter im HTML, die NICHT in AVAILABLE_VARIABLES
 * definiert sind → das sind die Custom-Variablen, die beim Generieren manuell
 * eingegeben werden müssen.
 */
export function extractCustomVariables(html: string): string[] {
  const knownKeys = new Set(AVAILABLE_VARIABLES.map((v) => v.key));
  const matches = html.match(/\{\{(\w+)\}\}/g) ?? [];
  const seen = new Set<string>();
  const custom: string[] = [];
  for (const m of matches) {
    const key = m.slice(2, -2);
    if (!knownKeys.has(key) && !seen.has(key)) {
      seen.add(key);
      custom.push(key);
    }
  }
  return custom;
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
  { key: 'befristet_bis', label: 'Befristet bis' },
  { key: 'probezeit_bis', label: 'Probezeit bis' },
  { key: 'stundenlohn', label: 'Stundenlohn' },
  { key: 'lohngruppe', label: 'Lohngruppe' },
  { key: 'tariflohn', label: 'Tariflohn' },
  { key: 'uebertariflicher_zuschlag', label: 'Übertariflicher Zuschlag' },
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
