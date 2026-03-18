import { useState, useMemo } from 'react';
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday, isSameDay, getDay, getDate, getYear,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ReminderManager } from '@/components/ReminderManager';
import { useReminders, type Reminder } from '@/hooks/useReminders';
import { useHolidays } from '@/hooks/useHolidays';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import { parseStoredDate } from '@/lib/date';

interface CalendarViewProps {
  topics: TopicWithSubtasks[];
}

interface DayEvent {
  label: string;
  color: string;
  type: 'reminder' | 'due' | 'completed' | 'holiday';
}

function getEventsForDay(
  date: Date,
  reminders: Reminder[],
  topics: TopicWithSubtasks[],
): DayEvent[] {
  const events: DayEvent[] = [];
  const dayOfMonth = getDate(date);
  const dayOfWeek = getDay(date);

  for (const r of reminders) {
    if (r.recurrence_type === 'monthly' && r.recurrence_day === dayOfMonth) {
      events.push({ label: r.title, color: r.color, type: 'reminder' });
    } else if (r.recurrence_type === 'weekly' && r.recurrence_day === dayOfWeek) {
      events.push({ label: r.title, color: r.color, type: 'reminder' });
    }
  }

  for (const t of topics) {
    const due = parseStoredDate(t.due_date);
    if (due && isSameDay(due, date)) {
      events.push({ label: t.title, color: '#f59e0b', type: 'due' });
    }
    for (const s of t.subtasks) {
      if (s.completed_at && isSameDay(new Date(s.completed_at), date)) {
        events.push({ label: `✓ ${s.title}`, color: '#10b981', type: 'completed' });
      }
    }
  }

  return events;
}

export function CalendarView({ topics }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { reminders, createReminder, deleteReminder } = useReminders();
  const { holidayMap } = useHolidays(getYear(currentMonth));

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const activeTopics = useMemo(() => topics.filter(t => t.status === 'activo' || t.status === 'seguimiento'), [topics]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    for (const day of calendarDays) {
      const key = format(day, 'yyyy-MM-dd');
      const events: DayEvent[] = [];

      // Add holiday first
      const holidayName = holidayMap.get(key);
      if (holidayName) {
        events.push({ label: holidayName, color: '#fca5a5', type: 'holiday' });
      }

      events.push(...getEventsForDay(day, reminders, activeTopics));
      if (events.length > 0) map.set(key, events);
    }
    return map;
  }, [calendarDays, reminders, activeTopics, holidayMap]);

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div className="flex-1 overflow-auto p-3 md:p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-semibold text-foreground capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {weekDays.map((d) => (
            <div key={d} className="bg-muted px-1 py-1.5 text-center text-[10px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {calendarDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const events = eventsByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const isHoliday = holidayMap.has(key);

            return (
              <Popover key={key}>
                <PopoverTrigger asChild>
                  <button
                    className={`min-h-[72px] md:min-h-[88px] p-1 text-left align-top transition-colors hover:bg-accent/30 focus:outline-none bg-background ${!inMonth ? 'opacity-40' : ''}`}
                    style={isHoliday && inMonth ? { backgroundColor: '#fef2f2' } : undefined}
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium ${today ? 'bg-primary text-primary-foreground' : isHoliday ? 'text-red-500 font-bold' : 'text-foreground'}`}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {events.slice(0, 3).map((ev, i) => (
                        <div key={i} className="flex items-center gap-1 truncate">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                          <span className={`text-[9px] md:text-[10px] truncate ${ev.type === 'holiday' ? 'text-red-400 font-medium' : 'text-muted-foreground'}`}>{ev.label}</span>
                        </div>
                      ))}
                      {events.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">+{events.length - 3} más</span>
                      )}
                    </div>
                  </button>
                </PopoverTrigger>
                {events.length > 0 && (
                  <PopoverContent className="w-64 p-3 space-y-2" align="start">
                    <p className="text-xs font-semibold text-foreground capitalize">
                      {format(day, "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                    {events.map((ev, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="h-2.5 w-2.5 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: ev.color }} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{ev.label}</p>
                          <Badge variant={ev.type === 'holiday' ? 'destructive' : 'outline'} className="text-[9px] h-4 mt-0.5">
                            {ev.type === 'holiday' ? 'Feriado' : ev.type === 'reminder' ? 'Recordatorio' : ev.type === 'due' ? 'Vencimiento' : 'Completada'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </PopoverContent>
                )}
              </Popover>
            );
          })}
        </div>

        {/* Reminder Manager */}
        <div className="border border-border rounded-lg p-4">
          <ReminderManager
            reminders={reminders}
            onCreate={(r) => createReminder.mutateAsync(r)}
            onDelete={(id) => deleteReminder.mutate(id)}
          />
        </div>
      </div>
    </div>
  );
}
