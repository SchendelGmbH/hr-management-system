export const CATEGORY_COLORS = [
  // Blautöne
  '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#0EA5E9', '#0891B2', '#06B6D4',
  // Grüntöne
  '#10B981', '#059669', '#047857', '#16A34A', '#15803D', '#22C55E', '#84CC16', '#65A30D',
  // Rottöne
  '#EF4444', '#DC2626', '#B91C1C', '#F43F5E', '#E11D48',
  // Orangetöne
  '#F97316', '#EA580C', '#C2410C', '#F59E0B', '#D97706', '#B45309',
  // Violett & Lila
  '#8B5CF6', '#7C3AED', '#6D28D9', '#A855F7', '#9333EA', '#7E22CE', '#6366F1', '#4F46E5',
  // Pink & Rose
  '#EC4899', '#DB2777', '#BE185D', '#F472B6',
  // Türkis & Teal
  '#14B8A6', '#0D9488', '#0F766E',
  // Indigo
  '#818CF8', '#6366F1', '#4338CA',
  // Braun & Erdetöne
  '#92400E', '#78350F', '#A16207', '#854D0E',
  // Grau-Blau
  '#475569', '#334155', '#64748B',
  // Spezialfarben
  '#0C4A6E', '#1E3A5F', '#831843', '#4A044E', '#14532D', '#7F1D1D',
  // Weitere Töne für 64 gesamt
  '#D946EF', '#F0ABFC', '#5EEAD4', '#FCD34D', '#FCA5A5', '#A5B4FC', '#6EE7B7',
];

/**
 * Gibt die erste Farbe aus der Palette zurück, die in `usedColors` noch nicht vorkommt.
 * Sind alle Farben vergeben, wird zyklisch rotiert.
 */
export function getNextColor(usedColors: string[]): string {
  const usedSet = new Set(usedColors.map((c) => c.toLowerCase()));
  for (const color of CATEGORY_COLORS) {
    if (!usedSet.has(color.toLowerCase())) {
      return color;
    }
  }
  // Alle Farben vergeben → zyklisch rotieren
  return CATEGORY_COLORS[usedColors.length % CATEGORY_COLORS.length];
}
