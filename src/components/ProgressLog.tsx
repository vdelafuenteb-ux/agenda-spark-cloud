import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Send, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';


interface GenericEntry {
  id: string;
  content: string;
  created_at: string;
}

interface ProgressLogProps {
  entries: GenericEntry[];
  onAdd: (content: string) => void;
  onUpdate?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
  hideTitle?: boolean;
}

export function ProgressLog({ entries, onAdd, onUpdate, onDelete, hideTitle = false }: ProgressLogProps) {
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [entries.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  };

  const handleStartEdit = (entry: GenericEntry) => {
    setEditingId(entry.id);
    setEditText(entry.content);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editText.trim()) return;
    onUpdate?.(editingId, editText.trim());
    setEditingId(null);
    setEditText('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bitácora de avances</p>

      {entries.length > 0 ? (
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-2 pr-2">
            {entries.map(entry => (
              <div key={entry.id} className="group rounded-md bg-muted/50 px-3 py-2">
                {editingId === entry.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="h-7 text-sm flex-1"
                      autoFocus
                    />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-500" onClick={handleSaveEdit}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={handleCancelEdit}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-card-foreground flex-1">{entry.content}</p>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {onUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => handleStartEdit(entry)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => onDelete(entry.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1" title={format(new Date(entry.created_at), "dd MMM yyyy HH:mm", { locale: es })}>
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      ) : (
        <p className="text-xs text-muted-foreground italic py-2">Sin entradas aún. Registra el primer avance.</p>
      )}

      <div className="flex items-center gap-2">
        <Input
          placeholder="Registrar avance..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          className="h-8 text-sm"
        />
        <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={handleSend}>
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
