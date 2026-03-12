import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

/**
 * POST /api/vertretung/suchen
 * 
 * Findet Vertretungsvorschläge für einen kranken Mitarbeiter
 * Algorithmus:
 * 1. Prüfe wer ist für denselben Zeitraum eingeteilt (DailyPlanAssignment + WorkSite)
 * 2. Finde Mitarbeiter die nicht krank/auf Urlaub sind (Vacation Tabelle)
 * 3. Prüfe passende Qualifikationen
 * 4. Sortiere nach Nähe (gleiche Baustelle/Vehicle zuerst)
 */

const searchSchema = z.object({
  krankerMitarbeiterId: z.string().min(1),
  startDatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  baustelleId: z.string().optional(), // Optional: spezifische Baustelle
});

interface VertretungsVorschlag {
  employeeId: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  score: number; // 0-100, höher ist besser
  gruende: string[]; // Warum diese Person passt
  qualifications: string[];
  istVerfuegbar: boolean;
  grundNichtVerfuegbar?: string;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = searchSchema.parse(body);

    const startDate = new Date(data.startDatum);
    const endDate = new Date(data.endDatum);
    endDate.setHours(23, 59, 59, 999); // Ende des Tages

    // Hole den kranken Mitarbeiter mit allen wichtigen Daten
    const krankerMitarbeiter = await prisma.employee.findUnique({
      where: { id: data.krankerMitarbeiterId },
      include: {
        department: true,
        qualifications: {
          include: { type: true },
        },
        planAssignments: {
          where: {
            site: {
              plan: {
                date: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
          include: {
            site: {
              include: {
                workSite: true,
                plan: true,
              },
            },
          },
        },
      },
    });

    if (!krankerMitarbeiter) {
      return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 });
    }

    // Baustellen IDs wo der kranke Mitarbeiter eingeplant war
    const geplanteBaustellenIds = krankerMitarbeiter.planAssignments
      .map(pa => pa.site.workSiteId)
      .filter((id): id is string => !!id);

    const geplanteBaustellenNamen = krankerMitarbeiter.planAssignments
      .map(pa => pa.site.name)
      .filter((name, idx, arr) => arr.indexOf(name) === idx);

    // Qualifikationen des kranken Mitarbeiters
    const krankerQualificationTypeIds = krankerMitarbeiter.qualifications.map(q => q.typeId);
    const krankerQualificationNames = krankerMitarbeiter.qualifications.map(q => q.type.name);

    // Finde alle anderen aktiven Mitarbeiter
    const alleMitarbeiter = await prisma.employee.findMany({
      where: {
        id: { not: data.krankerMitarbeiterId },
        isActive: true,
      },
      include: {
        department: true,
        qualifications: {
          include: { type: true },
        },
        vacations: {
          where: {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } },
            ],
          },
        },
        planAssignments: {
          where: {
            site: {
              plan: {
                date: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
          include: {
            site: {
              include: {
                workSite: true,
              },
            },
          },
        },
      },
    });

    // Berechne Vorschläge
    const vorschlaege: VertretungsVorschlag[] = alleMitarbeiter.map(mitarbeiter => {
      const gruende: string[] = [];
      let score = 0;

      // 1. Verfügbarkeit prüfen (Urlaub/Krankheit)
      const istImUrlaub = mitarbeiter.vacations.length > 0;
      const urlaubstyp = istImUrlaub ? mitarbeiter.vacations[0].vacationType : null;

      if (istImUrlaub) {
        const istKrank = urlaubstyp === 'SICK';
        return {
          employeeId: mitarbeiter.id,
          firstName: mitarbeiter.firstName,
          lastName: mitarbeiter.lastName,
          employeeNumber: mitarbeiter.employeeNumber,
          score: 0,
          gruende: [],
          qualifications: mitarbeiter.qualifications.map(q => q.type.name),
          istVerfuegbar: false,
          grundNichtVerfuegbar: istKrank ? 'Aktuell krankgemeldet' : 'Im Urlaub',
        };
      }

      // 2. Gleiche Abteilung = +20 Punkte
      if (mitarbeiter.departmentId === krankerMitarbeiter.departmentId) {
        score += 20;
        gruende.push(`Gleiche Abteilung: ${mitarbeiter.department?.name}`);
      }

      // 3. Gleiche Baustelle = +30 Punkte
      const istAufGleicherBaustelle = mitarbeiter.planAssignments.some(pa =>
        pa.site.workSiteId && geplanteBaustellenIds.includes(pa.site.workSiteId)
      );

      if (istAufGleicherBaustelle) {
        score += 30;
        gruende.push('Arbeitet bereits auf gleicher Baustelle');
      }

      // 4. Passende Qualifikationen = +25 Punkte pro match, max 50
      const passendeQualifikationen = mitarbeiter.qualifications.filter(q =>
        krankerQualificationTypeIds.includes(q.typeId)
      );

      if (passendeQualifikationen.length > 0) {
        score += Math.min(passendeQualifikationen.length * 25, 50);
        gruende.push(`${passendeQualifikationen.length} passende Qualifikation(en)`);
      }

      // 5. Mitarbeiter ist überhaupt irgendwo eingeplant = +10 (zeigt Verfügbarkeit)
      if (mitarbeiter.planAssignments.length > 0) {
        score += 10;
        gruende.push('Hat Arbeitsplanung');
      }

      return {
        employeeId: mitarbeiter.id,
        firstName: mitarbeiter.firstName,
        lastName: mitarbeiter.lastName,
        employeeNumber: mitarbeiter.employeeNumber,
        score: Math.min(score, 100),
        gruende,
        qualifications: mitarbeiter.qualifications.map(q => q.type.name),
        istVerfuegbar: true,
      };
    });

    // Sortiere: Verfügbare zuerst (nach Score), dann nicht verfügbare
    const verfuegbareVorschlaege = vorschlaege.filter(v => v.istVerfuegbar);
    const nichtVerfuegbareVorschlaege = vorschlaege.filter(v => !v.istVerfuegbar);

    // Sortiere verfügbare nach Score absteigend
    verfuegbareVorschlaege.sort((a, b) => b.score - a.score);

    // Nimm die Top 10
    const topVorschlaege = verfuegbareVorschlaege.slice(0, 10);

    return NextResponse.json({
      krankerMitarbeiter: {
        id: krankerMitarbeiter.id,
        name: `${krankerMitarbeiter.firstName} ${krankerMitarbeiter.lastName}`,
        employeeNumber: krankerMitarbeiter.employeeNumber,
        geplanteBaustellen: geplanteBaustellenNamen,
        qualifications: krankerQualificationNames,
      },
      zeitraum: {
        start: data.startDatum,
        end: data.endDatum,
      },
      vorschlaege: topVorschlaege,
      alternative: nichtVerfuegbareVorschlaege.slice(0, 5), // Top 5 nicht-verfügbare als Alternativen
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validierungsfehler', details: error.errors }, { status: 400 });
    }
    console.error('Error searching replacement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
