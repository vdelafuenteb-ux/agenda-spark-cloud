import { useState, useRef } from 'react';
import { useChecklist } from '@/hooks/useChecklist';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, X } from 'lucide-react';

export function ChecklistView() {
  const { items, isLoading, addItem, toggleItem, deleteItem, clearCompleted } = useChecklist();
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const pending = items.filter(i => !i.completed);
  const completed = items.filter(i => i.completed);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addItem.mutate(newTitle);
    setNewTitle('');
    inputRef.current?.focus();
  };

  return (
    <main className="flex-1 overflow-auto p-3 md:p-4">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Quick input */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Agregar tarea rápida..."
            className="flex-1"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={!newTitle.trim() || addItem.isPending}>
            Agregar
          </Button>
        </form>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
        ) : (
          <>
            {/* Pending items */}
            {pending.length === 0 && completed.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sin tareas. ¡Escribe algo arriba para empezar!
              </p>
            )}

            <div className="space-y-1">
              {pending.map(item => (
                <div key={item.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50 group transition-colors">
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => toggleItem.mutate({ id: item.id, completed: true })}
                  />
                  <span className="flex-1 text-sm text-foreground">{item.title}</span>
                  <button
                    onClick={() => deleteItem.mutate(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Completed items */}
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
                  <div key={item.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50 group transition-colors">
                    <Checkbox
                      checked={true}
                      onCheckedChange={() => toggleItem.mutate({ id: item.id, completed: false })}
                    />
                    <span className="flex-1 text-sm text-muted-foreground line-through">{item.title}</span>
                    <button
                      onClick={() => deleteItem.mutate(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
