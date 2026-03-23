import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Reminder } from '@/hooks/useReminders';

const DEFAULT_COLOR = '#9ca3af'; // gray - managed automatically
const DAYS_OF_WEEK = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDINALS = [
  { value: '1', label: 'Primer' },
  { value: '2', label: 'Segundo' },
  { value: '3', label: 'Tercer' },
  { value: '4', label: 'Cuarto' },
  { value: '-1', label: 'Último' },
];

type RecurrenceType = 'weekly' | 'monthly' | 'monthly_weekday' | 'last_business_day';

const MONTH_INTERVALS = [
  { value: '1', label: 'Cada mes' },
  { value: '2', label: 'Cada 2 meses' },
  { value: '3', label: 'Cada 3 meses' },
  { value: '4', label: 'Cada 4 meses' },
  { value: '6', label: 'Cada 6 meses' },
  { value: '12', label: 'Cada 12 meses' },
];

function describeReminder(r: Reminder): string {
  const monthSuffix = (r.recurrence_months ?? 1) > 1 ? ` (cada ${r.recurrence_months} meses)` : '';
  if (r.recurrence_type === 'monthly') return `Día ${r.recurrence_day} de cada mes${monthSuffix}`;
  if (r.recurrence_type === 'weekly') return `Cada ${DAYS_OF_WEEK[r.recurrence_day]}`;
  if (r.recurrence_type === 'last_business_day') return `Último día hábil del mes${monthSuffix}`;
  if (r.recurrence_type === 'monthly_weekday') {
    const ord = ORDINALS.find(o => o.value === String(r.recurrence_week));
    return `${ord?.label ?? ''} ${DAYS_OF_WEEK[r.recurrence_day]} de cada mes${monthSuffix}`;
  }
  return '';
}

interface ReminderManagerProps {
  reminders: Reminder[];
  onCreate: (r: Omit<Reminder, 'id' | 'user_id' | 'created_at'>) => Promise<any>;
  onDelete: (id: string) => void;
}

export function ReminderManager({ reminders, onCreate, onDelete }: ReminderManagerProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<RecurrenceType>('monthly');
  const [day, setDay] = useState(1);
  const [week, setWeek] = useState(1);
  const [monthInterval, setMonthInterval] = useState(1);

  const isMonthlyType = type !== 'weekly';

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      await onCreate({
        title: title.trim(),
        recurrence_type: type,
        recurrence_day: day,
        recurrence_week: type === 'monthly_weekday' ? week : null,
        recurrence_months: isMonthlyType ? monthInterval : 1,
        color: DEFAULT_COLOR,
      });
      setTitle('');
      toast.success('Recordatorio creado');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Recordatorios periódicos</h3>

      <div className="flex flex-col gap-2">
        <Input
          placeholder="Ej: Pagar cuenta de luz"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-8 text-xs"
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <div className="flex gap-2 items-center flex-wrap [&>*]:w-full [&>*]:sm:w-auto">
          <Select value={type} onValueChange={(v) => { setType(v as RecurrenceType); setDay(v === 'monthly' ? 1 : 1); }}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Día del mes</SelectItem>
              <SelectItem value="weekly">Cada semana</SelectItem>
              <SelectItem value="monthly_weekday">Día específico del mes</SelectItem>
              <SelectItem value="last_business_day">Último día hábil del mes</SelectItem>
            </SelectContent>
          </Select>

          {type === 'monthly' && (
            <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
              <SelectTrigger className="h-8 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>Día {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {type === 'weekly' && (
            <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((name, i) => (
                  <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {type === 'monthly_weekday' && (
            <>
              <Select value={String(week)} onValueChange={(v) => setWeek(Number(v))}>
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDINALS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {isMonthlyType && (
            <Select value={String(monthInterval)} onValueChange={(v) => setMonthInterval(Number(v))}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_INTERVALS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button size="sm" className="h-8 text-xs gap-1" onClick={handleCreate}>
            <Plus className="h-3 w-3" /> Agregar
          </Button>
        </div>
      </div>

      {reminders.length > 0 && (
        <div className="space-y-1">
          {reminders.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                <span className="truncate font-medium">{r.title}</span>
                <span className="text-muted-foreground shrink-0">
                  {describeReminder(r)}
                </span>
              </div>
              <button onClick={() => onDelete(r.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
