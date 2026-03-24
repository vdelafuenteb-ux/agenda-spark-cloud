import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Send, Pencil, Trash2, Check, X, Bold, Italic, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';


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

/** Apply formatting around selection or at cursor in a textarea */
function applyFormat(
  textarea: HTMLTextAreaElement,
  type: 'bold' | 'italic' | 'bullet',
  text: string,
  setText: (v: string) => void
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = text.substring(start, end);

  let replacement: string;
  let cursorOffset: number;

  if (type === 'bold') {
    replacement = selected ? `**${selected}**` : '**texto**';
    cursorOffset = selected ? replacement.length : 2;
  } else if (type === 'italic') {
    replacement = selected ? `_${selected}_` : '_texto_';
    cursorOffset = selected ? replacement.length : 1;
  } else {
    // Bullet: add "• " at line start
    const beforeCursor = text.substring(0, start);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const newText = text.substring(0, lineStart) + '• ' + text.substring(lineStart);
    setText(newText);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      textarea.focus();
    }, 0);
    return;
  }

  const newText = text.substring(0, start) + replacement + text.substring(end);
  setText(newText);
  setTimeout(() => {
    if (selected) {
      textarea.selectionStart = start;
      textarea.selectionEnd = start + replacement.length;
    } else {
      textarea.selectionStart = start + cursorOffset;
      textarea.selectionEnd = start + cursorOffset + 5; // select "texto"
    }
    textarea.focus();
  }, 0);
}

/** Render formatted text: **bold**, _italic_, • bullets, newlines */
function FormattedText({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="text-sm text-card-foreground space-y-0.5">
      {lines.map((line, i) => {
        const isBullet = line.startsWith('• ') || line.startsWith('- ');
        const cleanLine = isBullet ? line.substring(2) : line;
        const formatted = formatInline(cleanLine);

        if (isBullet) {
          return (
            <div key={i} className="flex items-start gap-1.5 pl-1">
              <span className="text-muted-foreground mt-0.5 text-xs">•</span>
              <span>{formatted}</span>
            </div>
          );
        }
        return <div key={i}>{formatted || <br />}</div>;
      })}
    </div>
  );
}

/** Parse **bold** and _italic_ inline markers */
function formatInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Simple regex-based parsing for **bold** and _italic_
  const regex = /(\*\*(.+?)\*\*)|(_(.+?)_)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index} className="font-semibold">{match[2]}</strong>);
    } else if (match[4]) {
      parts.push(<em key={match.index} className="italic">{match[4]}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

export function ProgressLog({ entries, onAdd, onUpdate, onDelete, hideTitle = false }: ProgressLogProps) {
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }, []);

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

  const FormatToolbar = ({ targetRef, value, setValue }: { targetRef: React.RefObject<HTMLTextAreaElement>; value: string; setValue: (v: string) => void }) => (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => targetRef.current && applyFormat(targetRef.current, 'bold', value, setValue)}
        title="Negrita"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => targetRef.current && applyFormat(targetRef.current, 'italic', value, setValue)}
        title="Cursiva"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => targetRef.current && applyFormat(targetRef.current, 'bullet', value, setValue)}
        title="Viñeta"
      >
        <List className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-2">
      {!hideTitle && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bitácora de avances</p>}

      {entries.length > 0 ? (
        <ScrollArea className="max-h-[180px]">
          <div className="divide-y divide-border pr-2">
            {entries.map(entry => (
              <div key={entry.id} className="group px-3 py-2.5 first:pt-0">
                {editingId === entry.id ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <FormatToolbar targetRef={editTextareaRef} value={editText} setValue={setEditText} />
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-emerald-500" onClick={handleSaveEdit}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={handleCancelEdit}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      ref={editTextareaRef}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="min-h-[60px] text-sm resize-none"
                      autoFocus
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <FormattedText content={entry.content} />
                      </div>
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

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <FormatToolbar targetRef={textareaRef} value={text} setValue={setText} />
          <Button size="sm" variant="ghost" className="h-7 shrink-0" onClick={handleSend} disabled={!text.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Textarea
          ref={textareaRef}
          placeholder="Registrar avance... (Shift+Enter para nueva línea)"
          value={text}
          onChange={e => setText(e.target.value)}
          
          className="min-h-[70px] text-sm resize-y"
          rows={3}
        />
      </div>
    </div>
  );
}
