import { useState, useMemo } from 'react';
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday, isSameDay, getYear, isBefore, startOfDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ReminderManager } from '@/components/ReminderManager';
import { useReminders } from '@/hooks/useReminders';
import { useReminderCompletions } from '@/hooks/useReminderCompletions';
import { useHolidays } from '@/hooks/useHolidays';
import { reminderMatchesDate } from '@/lib/reminderMatch';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import { parseStoredDate } from '@/lib/date';

interface CalendarViewProps {
  topics: TopicWithSubtasks[];
}

interface DayEvent {
  label: string;
  color: string;
  type: 'reminder' | 'due' | 'completed' | 'holiday';
  reminderId?: string;
}

const COLOR_PENDING = '#9ca3af';   // gray
const COLOR_COMPLETED = '#22c55e'; // green
const COLOR_OVERDUE = '#ef4444';   // red

function getEventsForDay(
  date: Date,
  reminders: import('@/hooks/useReminders').Reminder[],
  topics: TopicWithSubtasks[],
  isReminderCompleted: (id: string, dateStr: string) => boolean,
): DayEvent[] {
  const events: DayEvent[] = [];
  const dateStr = format(date, 'yyyy-MM-dd');
  const todayStart = startOfDay(new Date());
  const isPast = isBefore(date, todayStart) && !isToday(date);

  // Only show reminders from the week of March 16 onwards
  const reminderCutoff = new Date(2026, 2, 16); // March 16, 2026
  const showRemindersForDate = !isBefore(date, reminderCutoff);

  if (showRemindersForDate) {
    for (const r of reminders) {
      if (reminderMatchesDate(r, date)) {
        const done = isReminderCompleted(r.id, dateStr);
        const color = done ? COLOR_COMPLETED : isPast ? COLOR_OVERDUE : COLOR_PENDING;
        events.push({ label: r.title, color, type: done ? 'completed' : 'reminder', reminderId: r.id });
      }
    }
  }

  for (const t of topics) {
    const due = parseStoredDate(t.due_date);
    if (due && isSameDay(due, date)) {
      const done = t.status === 'completado';
      const color = done ? COLOR_COMPLETED : isPast ? COLOR_OVERDUE : COLOR_PENDING;
      events.push({ label: t.title, color, type: done ? 'completed' : 'due' });
    }
    for (const s of t.subtasks) {
      const sDue = parseStoredDate(s.due_date);
      if (sDue && isSameDay(sDue, date)) {
        const color = s.completed ? COLOR_COMPLETED : isPast ? COLOR_OVERDUE : COLOR_PENDING;
        events.push({ label: s.completed ? `✓ ${s.title}` : s.title, color, type: s.completed ? 'completed' : 'due' });
      }
    }
  }

  return events;
}

export function CalendarView({ topics }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showReminders, setShowReminders] = useState(false);
  const [showPeriodicEvents, setShowPeriodicEvents] = useState(true);
  const { reminders, createReminder, deleteReminder } = useReminders();
  const { isCompleted, toggleCompletion } = useReminderCompletions();
  const { holidayMap } = useHolidays(getYear(currentMonth));

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const activeTopics = useMemo(() => topics.filter(t => t.status === 'activo' || t.status === 'seguimiento'), [topics]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    const activeReminders = showPeriodicEvents ? reminders : [];
    for (const day of calendarDays) {
      const key = format(day, 'yyyy-MM-dd');
      const events: DayEvent[] = [];

      const holidayName = holidayMap.get(key);
      if (holidayName) {
        events.push({ label: holidayName, color: '#fca5a5', type: 'holiday' });
      }

      events.push(...getEventsForDay(day, activeReminders, activeTopics, isCompleted));
      if (events.length > 0) map.set(key, events);
    }
    return map;
  }, [calendarDays, reminders, activeTopics, holidayMap, showPeriodicEvents]);

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const handleToggleCompletion = (reminderId: string, dateStr: string) => {
    toggleCompletion.mutate({ reminder_id: reminderId, completed_date: dateStr });
  };

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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_PENDING }} />
              <span className="text-[10px] text-muted-foreground">Pendiente</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_COMPLETED }} />
              <span className="text-[10px] text-muted-foreground">Completado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_OVERDUE }} />
              <span className="text-[10px] text-muted-foreground">Atrasado</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="show-periodic" className="text-xs text-muted-foreground cursor-pointer">
              Mostrar recordatorios
            </Label>
            <Switch
            id="show-periodic"
            checked={showPeriodicEvents}
            onCheckedChange={setShowPeriodicEvents}
          />
          </div>
        </div>
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
                    style={isHoliday && inMonth ? { backgroundColor: 'hsl(0 86% 97%)' } : undefined}
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium ${today ? 'bg-primary text-primary-foreground' : isHoliday ? 'text-destructive font-bold' : 'text-foreground'}`}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {events.slice(0, 3).map((ev, i) => {
                        const done = ev.reminderId ? isCompleted(ev.reminderId, key) : false;
                        return (
                          <div key={i} className="flex items-center gap-1 truncate">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                            <span className={`text-[9px] md:text-[10px] truncate ${ev.type === 'holiday' ? 'text-destructive/70 font-medium' : done ? 'text-muted-foreground line-through' : 'text-muted-foreground'}`}>
                              {ev.label}
                            </span>
                          </div>
                        );
                      })}
                      {events.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">+{events.length - 3} más</span>
                      )}
                    </div>
                  </button>
                </PopoverTrigger>
                {events.length > 0 && (
                  <PopoverContent className="w-72 p-3 space-y-2" align="start">
                    <p className="text-xs font-semibold text-foreground capitalize">
                      {format(day, "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                    {events.map((ev, i) => {
                      const done = ev.reminderId ? isCompleted(ev.reminderId, key) : false;
                      return (
                        <div key={i} className="flex items-start gap-2">
                          {ev.reminderId ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleCompletion(ev.reminderId!, key);
                              }}
                              className="mt-0.5 shrink-0 hover:scale-110 transition-transform"
                            >
                              {done ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          ) : (
                            <span className="h-2.5 w-2.5 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: ev.color }} />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-medium truncate ${done ? 'line-through text-muted-foreground' : ''}`}>
                              {ev.label}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant={ev.type === 'holiday' ? 'destructive' : 'outline'} className="text-[9px] h-4">
                                {ev.type === 'holiday' ? 'Feriado' : ev.type === 'reminder' ? 'Recordatorio' : ev.type === 'due' ? 'Vencimiento' : 'Completada'}
                              </Badge>
                              {ev.reminderId && done && (
                                <span className="text-[9px] text-emerald-500 font-medium">✓ Hecho</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </PopoverContent>
                )}
              </Popover>
            );
          })}
        </div>

        {/* Reminders toggle */}
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowReminders((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent/30 transition-colors"
          >
            <span>Recordatorios periódicos ({reminders.length})</span>
            {showReminders ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {showReminders && (
            <div className="px-4 pb-4">
              <ReminderManager
                reminders={reminders}
                onCreate={(r) => createReminder.mutateAsync(r)}
                onDelete={(id) => deleteReminder.mutate(id)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
