import { useState, useRef, useEffect } from 'react';
import { formatStoredDate, parseStoredDate, toStoredDate, isStoredDateOverdue } from '@/lib/date';
import { CalendarIcon, Trash2, MessageSquare } from 'lucide-react';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type Subtask = Database['public']['Tables']['subtasks']['Row'] & { notes?: string };

interface SubtaskRowProps {
  subtask: Subtask;
  subtaskIsToday: boolean;
  onToggleSubtask: (id: string, completed: boolean) => void;
  onUpdateSubtask: (id: string, data: any) => void;
  onDeleteSubtask: (id: string) => void;
}

export function SubtaskRow({ subtask, subtaskIsToday, onToggleSubtask, onUpdateSubtask, onDeleteSubtask }: SubtaskRowProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(subtask.notes || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync from prop
  useEffect(() => {
    setNotes(subtask.notes || '');
  }, [subtask.notes]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdateSubtask(subtask.id, { notes: value });
    }, 600);
  };

  const hasNotes = (subtask.notes || '').trim().length > 0;

  return (
    <div className={cn('rounded-md px-1.5 py-1 -mx-1.5 transition-colors', subtaskIsToday && 'bg-accent/50 ring-1 ring-accent')}>
      <div className="flex items-center gap-2 group">
        <Checkbox
          checked={subtask.completed}
          onCheckedChange={(checked) => onToggleSubtask(subtask.id, !!checked)}
        />
        <div className={cn('flex-1 min-w-0 flex items-center gap-1.5', subtask.completed && 'line-through text-muted-foreground')}>
          <span className="text-sm truncate">{subtask.title}</span>
          {subtaskIsToday && (
            <Badge className="text-[9px] px-1 py-0 bg-primary text-primary-foreground border-transparent shrink-0">Hoy</Badge>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowNotes(!showNotes)}
          className={cn(
            'flex items-center gap-0.5 text-[10px] transition-colors shrink-0',
            hasNotes || showNotes ? 'text-primary' : 'text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100'
          )}
          title="Comentarios"
        >
          <MessageSquare className="h-3 w-3" />
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <CalendarIcon className="h-3 w-3" />
              {subtask.due_date ? (
                formatStoredDate(subtask.due_date, 'dd MMM', { locale: es })
              ) : (
                <span>Sin fecha</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={parseStoredDate(subtask.due_date)}
              onSelect={(date) => onUpdateSubtask(subtask.id, { due_date: toStoredDate(date) })}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={() => onDeleteSubtask(subtask.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
      {showNotes && (
        <div className="mt-1.5 ml-6">
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Agregar comentario..."
            className="w-full text-xs bg-muted/50 border border-border rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring min-h-[48px] placeholder:text-muted-foreground"
            rows={2}
          />
        </div>
      )}
    </div>
  );
}
