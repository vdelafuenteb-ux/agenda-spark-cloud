import { useState } from 'react';
import { useTopicReminders } from '@/hooks/useTopicReminders';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Bell, Plus, Trash2, CalendarIcon, Check } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface TopicRemindersProps {
  topicId: string;
}

export function TopicReminders({ topicId }: TopicRemindersProps) {
  const { reminders, isLoading, createReminder, updateReminder, deleteReminder } = useTopicReminders(topicId);
  const [addOpen, setAddOpen] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<Date | undefined>();
  const [editNote, setEditNote] = useState('');

  const handleCreate = async () => {
    if (!newDate) return;
    const dateStr = format(newDate, 'yyyy-MM-dd');
    await createReminder.mutateAsync({ reminder_date: dateStr, note: newNote });
    toast.success('Recordatorio programado');
    setNewDate(undefined);
    setNewNote('');
    setAddOpen(false);
  };

  const handleUpdate = async (id: string) => {
    if (!editDate) return;
    await updateReminder.mutateAsync({ id, reminder_date: format(editDate, 'yyyy-MM-dd'), note: editNote });
    toast.success('Recordatorio actualizado');
    setEditingId(null);
  };

  const startEdit = (r: typeof reminders[0]) => {
    setEditingId(r.id);
    setEditDate(new Date(r.reminder_date + 'T12:00:00'));
    setEditNote(r.note);
  };

  const pendingReminders = reminders.filter((r) => !r.sent);
  const sentReminders = reminders.filter((r) => r.sent);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Bell className="h-3.5 w-3.5" />
          <span>Recordatorios ({pendingReminders.length})</span>
        </div>
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Agregar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 space-y-3" align="end">
            <p className="text-xs font-medium">Programar recordatorio</p>
            <Calendar
              mode="single"
              selected={newDate}
              onSelect={setNewDate}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              className="pointer-events-auto"
              locale={es}
            />
            <Textarea
              placeholder="Nota opcional (ej: Revisar avance polígonos)"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="text-xs min-h-[60px]"
            />
            <Button
              size="sm"
              className="w-full text-xs"
              disabled={!newDate || createReminder.isPending}
              onClick={handleCreate}
            >
              <CalendarIcon className="h-3 w-3 mr-1" />
              {newDate ? `Recordar el ${format(newDate, 'dd MMM yyyy', { locale: es })}` : 'Selecciona fecha'}
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando...</p>
      ) : reminders.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin recordatorios programados</p>
      ) : (
        <div className="space-y-1.5">
          {pendingReminders.map((r) => (
            <div key={r.id} className="flex items-start gap-2 text-xs bg-muted/50 rounded-md p-2">
              {editingId === r.id ? (
                <div className="flex-1 space-y-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-start">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {editDate ? format(editDate, 'dd MMM yyyy', { locale: es }) : 'Fecha'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editDate}
                        onSelect={setEditDate}
                        className="pointer-events-auto"
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                  <Textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="text-xs min-h-[40px]"
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6 text-xs" onClick={() => handleUpdate(r.id)} disabled={!editDate}>
                      Guardar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 cursor-pointer" onClick={() => startEdit(r)}>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[9px] border-amber-500/50 text-amber-600 px-1.5 py-0">
                        Pendiente
                      </Badge>
                      <span className="font-medium">
                        {format(new Date(r.reminder_date + 'T12:00:00'), 'dd MMM yyyy', { locale: es })}
                      </span>
                    </div>
                    {r.note && <p className="text-muted-foreground mt-0.5">{r.note}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteReminder.mutate(r.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {sentReminders.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded-md p-2 opacity-60">
              <Check className="h-3 w-3 text-emerald-500" />
              <Badge variant="outline" className="text-[9px] border-emerald-500/50 text-emerald-600 px-1.5 py-0">
                Enviado
              </Badge>
              <span>{format(new Date(r.reminder_date + 'T12:00:00'), 'dd MMM yyyy', { locale: es })}</span>
              {r.note && <span className="text-muted-foreground">— {r.note}</span>}
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 ml-auto text-muted-foreground hover:text-destructive"
                onClick={() => deleteReminder.mutate(r.id)}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
