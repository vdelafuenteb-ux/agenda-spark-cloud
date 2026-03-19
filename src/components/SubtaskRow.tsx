import { useState } from 'react';
import { formatStoredDate, parseStoredDate, toStoredDate, isStoredDateOverdue } from '@/lib/date';
import { CalendarIcon, Trash2, MessageSquare } from 'lucide-react';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ProgressLog } from '@/components/ProgressLog';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';
import type { SubtaskEntry } from '@/hooks/useTopics';

type Subtask = Database['public']['Tables']['subtasks']['Row'] & { subtask_entries: SubtaskEntry[] };

interface SubtaskRowProps {
  subtask: Subtask;
  subtaskIsToday: boolean;
  subtaskIsUpcoming?: boolean;
  onToggleSubtask: (id: string, completed: boolean) => void;
  onUpdateSubtask: (id: string, data: any) => void;
  onDeleteSubtask: (id: string) => void;
  onAddSubtaskEntry: (subtaskId: string, content: string) => void;
  onUpdateSubtaskEntry?: (id: string, content: string) => void;
  onDeleteSubtaskEntry?: (id: string) => void;
}

export function SubtaskRow({ subtask, subtaskIsToday, subtaskIsUpcoming = false, onToggleSubtask, onUpdateSubtask, onDeleteSubtask, onAddSubtaskEntry, onUpdateSubtaskEntry, onDeleteSubtaskEntry }: SubtaskRowProps) {
  const [showEntries, setShowEntries] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(subtask.title);

  const hasEntries = (subtask.subtask_entries || []).length > 0;
  const isOverdue = !subtask.completed && isStoredDateOverdue(subtask.due_date);

  return (
    <div className={cn(
      'rounded-md px-1.5 py-1 -mx-1.5 transition-colors',
      subtaskIsToday && 'bg-accent/50 ring-1 ring-accent',
      isOverdue && 'bg-destructive/10 ring-1 ring-destructive/30',
      subtaskIsUpcoming && !isOverdue && 'bg-yellow-500/10 ring-1 ring-yellow-500/30'
    )}>
      <div className="flex items-center gap-2 group">
        <Checkbox
          checked={subtask.completed}
          onCheckedChange={(checked) => onToggleSubtask(subtask.id, !!checked)}
        />
        <div className={cn('flex-1 min-w-0 flex items-center gap-1.5', subtask.completed && 'line-through text-muted-foreground')}>
          {editingTitle ? (
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (titleDraft.trim()) onUpdateSubtask(subtask.id, { title: titleDraft.trim() });
                  setEditingTitle(false);
                }
                if (e.key === 'Escape') {
                  setTitleDraft(subtask.title);
                  setEditingTitle(false);
                }
              }}
              onBlur={() => {
                if (titleDraft.trim() && titleDraft.trim() !== subtask.title) {
                  onUpdateSubtask(subtask.id, { title: titleDraft.trim() });
                }
                setEditingTitle(false);
              }}
              className="text-sm bg-transparent border-b border-primary outline-none flex-1 min-w-0"
              autoFocus
            />
          ) : (
            <span
              className={cn(
                'text-sm truncate cursor-pointer hover:underline',
                isOverdue && 'text-destructive font-medium',
                subtaskIsUpcoming && !isOverdue && 'text-yellow-700 font-medium'
              )}
              onDoubleClick={() => {
                setTitleDraft(subtask.title);
                setEditingTitle(true);
              }}
              title="Doble clic para editar"
            >{subtask.title}</span>
          )}
          {subtaskIsToday && (
            <Badge className="text-[9px] px-1 py-0 bg-primary text-primary-foreground border-transparent shrink-0">Hoy</Badge>
          )}
          {isOverdue && (
            <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">Atrasada</Badge>
          )}
          {subtaskIsUpcoming && !isOverdue && (
            <Badge className="text-[9px] px-1 py-0 bg-yellow-500 text-white border-transparent shrink-0">Próxima</Badge>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowEntries(!showEntries)}
          className={cn(
            'flex items-center gap-0.5 text-[10px] transition-colors shrink-0',
            hasEntries || showEntries ? 'text-primary' : 'text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100'
          )}
          title="Bitácora de avances"
        >
          <MessageSquare className="h-3 w-3" />
          {hasEntries && <span>{subtask.subtask_entries.length}</span>}
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center gap-1 text-[10px] transition-colors shrink-0',
                isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground hover:text-foreground'
              )}
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
      {showEntries && (
        <div className="mt-1.5 ml-6">
          <ProgressLog
            entries={subtask.subtask_entries || []}
            onAdd={(content) => onAddSubtaskEntry(subtask.id, content)}
            onUpdate={onUpdateSubtaskEntry ? (id, content) => onUpdateSubtaskEntry(id, content) : undefined}
            onDelete={onDeleteSubtaskEntry}
          />
        </div>
      )}
    </div>
  );
}
