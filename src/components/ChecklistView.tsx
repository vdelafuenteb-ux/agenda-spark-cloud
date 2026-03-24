import { useState, useRef } from 'react';
import { useChecklist } from '@/hooks/useChecklist';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Trash2, X, CalendarIcon } from 'lucide-react';
import { parseStoredDate, toStoredDate, formatStoredDate, isStoredDateToday, isStoredDateOverdue } from '@/lib/date';

export function ChecklistView() {
  const { items, isLoading, addItem, updateItem, toggleItem, deleteItem, clearCompleted } = useChecklist();
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState<Date | undefined>();
  const [dateOpen, setDateOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pending = items.filter(i => !i.completed);
  const completed = items.filter(i => i.completed);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addItem.mutate({ title: newTitle, due_date: toStoredDate(newDueDate) });
    setNewTitle('');
    setNewDueDate(undefined);
    inputRef.current?.focus();
  };

  return (
    <main className="flex-1 overflow-auto p-3 md:p-4">
      <div className="max-w-xl mx-auto space-y-4">
        <form
          onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
          className="flex gap-2 items-center"
        >
          <Input
            ref={inputRef}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Agregar tarea rápida..."
            className="flex-1"
            autoFocus
          />
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="shrink-0 relative">
                <CalendarIcon className="h-4 w-4" />
                {newDueDate && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={newDueDate}
                onSelect={(d) => { setNewDueDate(d); setDateOpen(false); }}
              />
            </PopoverContent>
          </Popover>
          <Button type="submit" size="sm" disabled={!newTitle.trim() || addItem.isPending}>
            Agregar
          </Button>
        </form>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
        ) : (
          <>
            {pending.length === 0 && completed.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sin tareas. ¡Escribe algo arriba para empezar!
              </p>
            )}

            <div className="space-y-1">
              {pending.map(item => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  onToggle={() => toggleItem.mutate({ id: item.id, completed: true })}
                  onDelete={() => deleteItem.mutate(item.id)}
                  onUpdateDate={(due_date) => updateItem.mutate({ id: item.id, due_date })}
                  onUpdateTitle={(title) => updateItem.mutate({ id: item.id, title })}
                />
              ))}
            </div>

            {completed.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-border">
                <div className="flex items-center justify-between px-3 pb-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    Completados ({completed.length})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => clearCompleted.mutate()}
                    disabled={clearCompleted.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                    Limpiar
                  </Button>
                </div>
                {completed.map(item => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    completed
                    onToggle={() => toggleItem.mutate({ id: item.id, completed: false })}
                    onDelete={() => deleteItem.mutate(item.id)}
                    onUpdateDate={(due_date) => updateItem.mutate({ id: item.id, due_date })}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function ChecklistRow({ item, completed, onToggle, onDelete, onUpdateDate, onUpdateTitle }: {
  item: { id: string; title: string; due_date: string | null };
  completed?: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdateDate: (due_date: string | null) => void;
  onUpdateTitle: (title: string) => void;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const isToday = isStoredDateToday(item.due_date);
  const isOverdue = !completed && isStoredDateOverdue(item.due_date);

  const commitEdit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.title) {
      onUpdateTitle(trimmed);
    } else {
      setDraft(item.title);
    }
  };

  return (
    <div className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50 group transition-colors ${isOverdue ? 'bg-destructive/5' : ''}`}>
      <Checkbox checked={!!completed} onCheckedChange={onToggle} />
      {editing ? (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setDraft(item.title); setEditing(false); } }}
          className="flex-1 h-7 text-sm"
          autoFocus
        />
      ) : (
        <span
          className={`flex-1 text-sm cursor-pointer ${completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}
          onDoubleClick={() => { if (!completed) { setDraft(item.title); setEditing(true); } }}
        >
          {item.title}
        </span>
      )}
      {item.due_date && (
        <Badge
          variant={isOverdue ? 'destructive' : isToday ? 'default' : 'outline'}
          className="text-[10px] h-5 shrink-0"
        >
          {formatStoredDate(item.due_date, 'd MMM')}
        </Badge>
      )}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity">
            <CalendarIcon className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={parseStoredDate(item.due_date)}
            onSelect={(d) => { onUpdateDate(toStoredDate(d) ?? null); setDateOpen(false); }}
          />
          {item.due_date && (
            <div className="p-2 border-t">
              <Button variant="ghost" size="sm" className="w-full text-xs text-destructive" onClick={() => { onUpdateDate(null); setDateOpen(false); }}>
                Quitar fecha
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
