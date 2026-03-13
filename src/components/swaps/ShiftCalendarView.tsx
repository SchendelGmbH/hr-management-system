/**
 * ShiftCalendarView - Kalender-Ansicht mit Schichten und Swap-Button
 * Erweitert den bestehenden Kalender um Schicht-Events
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import deLocale from '@fullcalendar/core/locales/de.js';
import { CalendarIcon, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { SwapButton } from '@/components/swaps/SwapButton';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

interface ShiftEvent {
  id: string;
  assignmentId: string;
  employeeId: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  type: string;
  extendedProps: {
    isShift: boolean;
    assignmentId: string;
    employeeId: string;
    employeeName: string;
    department?: string;
    siteId: string;
    siteName: string;
    location?: string;
    startTime: string;
    endTime: string;
    workSiteName?: string;
    hasActiveSwap: boolean;
    swapStatus: string | null;
  };
}

interface ShiftCalendarViewProps {
  employeeId?: string;
  showAllShifts?: boolean; // Admin: alle Schichten anzeigen
}

export function ShiftCalendarView({ employeeId, showAllShifts = false }: ShiftCalendarViewProps) {
  const { data: session } = useSession();
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'dayGridMonth' | 'timeGridWeek'>('dayGridMonth');
  const [currentDate, setCurrentDate] = useState(new Date());

  const loadEvents = useCallback(async (start: Date, end: Date) => {
    if (!employeeId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
        employeeId: showAllShifts ? '' : employeeId,
      });

      const response = await fetch(`/api/calendar/shifts?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error loading shifts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, showAllShifts]);

  // Initial laden
  useEffect(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    loadEvents(start, end);
  }, [currentDate, loadEvents]);

  const handleDatesSet = (dateInfo: any) => {
    loadEvents(dateInfo.start, dateInfo.end);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToPrev = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const customEventContent = (arg: any) => {
    const { extendedProps } = arg.event;
    
    if (!extendedProps?.isShift) {
      return (
        <div className="px-1 py-0.5 overflow-hidden">
          <div className="font-medium text-xs truncate">{arg.event.title}</div>
        </div>
      );
    }

    const isMyShift = extendedProps.employeeId === employeeId;
    const isPending = extendedProps.hasActiveSwap;

    return (
      <div className="px-1 py-0.5 h-full flex flex-col">
        {/* Schicht-Info */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate" title={extendedProps.siteName}>
            {extendedProps.siteName}
          </div>
          <div className="text-[10px] opacity-80 truncate">
            {extendedProps.startTime} - {extendedProps.endTime}
          </div>
        </div>

        {/* Tausch-Button (nur für eigene Schichten) */}
        {isMyShift && (
          <div className="mt-1 flex justify-end">
            {isPending ? (
              <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded"
              title="Tauschanfrage ausstehend"
              >
                Tausch...
              </span>
            ) : (
              <SwapButton
                assignmentId={extendedProps.assignmentId}
                employeeId={extendedProps.employeeId}
                date={new Date(arg.event.start)}
                siteName={extendedProps.siteName}
                startTime={extendedProps.startTime}
                endTime={extendedProps.endTime}
                variant="icon"
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Meine Schichten
              </h2>
              <p className="text-sm text-gray-500">
                {format(currentDate, 'MMMM yyyy', { locale: de })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToPrev}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Heute
            </button>
            <button
              onClick={goToNext}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="text-gray-600">Eigene Schicht</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400"></span>
            <span className="text-gray-600">Tausch ausstehend</span>
          </div>
          {showAllShifts && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gray-400"></span>
              <span className="text-gray-600">Andere Mitarbeiter</span>
            </div>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div className="p-4">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        )}

        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          locale={deLocale}
          firstDay={1}
          headerToolbar={false} // Custom header
          events={events}
          eventContent={customEventContent}
          datesSet={handleDatesSet}
          height="auto"
          dayMaxEvents={4}
          eventMinHeight={60}
          eventClick={(info) => {
            // Prevent navigation if clicking swap button
            if ((info.jsEvent.target as HTMLElement)?.closest('button')) {
              return;
            }
          }}
        />
      </div>

      {/* Stats */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-500">Schichten: </span>
            <span className="font-medium text-gray-900">{events.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Tausch ausstehend: </span>
            <span className="font-medium text-amber-600">
              {events.filter(e => e.extendedProps.hasActiveSwap).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
