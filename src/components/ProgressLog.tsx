import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ProgressEntry } from '@/hooks/useTopics';

interface ProgressLogProps {
  entries: ProgressEntry[];
  onAdd: (content: string) => void;
}

export function ProgressLog({ entries, onAdd }: ProgressLogProps) {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bitácora de avances</p>

      {entries.length > 0 ? (
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-2 pr-2">
            {entries.map(entry => (
              <div key={entry.id} className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-sm text-card-foreground">{entry.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1" title={format(new Date(entry.created_at), "dd MMM yyyy HH:mm", { locale: es })}>
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: es })}
                </p>
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
