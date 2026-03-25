import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Send, Pencil, Trash2, Check, X, Bold, Italic, List, Paperclip, FileText, Image, File, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { EntryAttachment } from '@/hooks/useTopics';

interface GenericEntry {
  id: string;
  content: string;
  created_at: string;
  attachments?: EntryAttachment[];
}

interface ProgressLogProps {
  entries: GenericEntry[];
  onAdd: (content: string) => Promise<string>;
  onUpdate?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
  onUploadFiles?: (entryId: string, files: File[]) => void;
  onDeleteAttachment?: (id: string, fileUrl: string) => void;
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
      textarea.selectionEnd = start + cursorOffset + 5;
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

function formatInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(_(.+?)_)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));
    if (match[2]) parts.push(<strong key={match.index} className="font-semibold">{match[2]}</strong>);
    else if (match[4]) parts.push(<em key={match.index} className="italic">{match[4]}</em>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.substring(lastIndex));
  return parts.length > 0 ? parts : [text];
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return Image;
  if (fileType === 'application/pdf') return FileText;
  return File;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentList({ attachments, onDelete }: { attachments: EntryAttachment[]; onDelete?: (id: string, fileUrl: string) => void }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {attachments.map((att) => {
        const isImage = att.file_type.startsWith('image/');
        const isPdf = att.file_type === 'application/pdf';
        const Icon = getFileIcon(att.file_type);

        if (isImage) {
          return (
            <div key={att.id} className="group/att relative">
              <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={att.file_url}
                  alt={att.file_name}
                  className="h-16 w-16 object-cover rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                />
              </a>
              {onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 p-0 rounded-full opacity-0 group-hover/att:opacity-100 transition-opacity"
                  onClick={() => onDelete(att.id, att.file_url)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        }

        return (
          <div key={att.id} className="group/att relative flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-muted/50 text-xs max-w-[200px]">
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <a
              href={att.file_url}
              target={isPdf ? '_blank' : undefined}
              rel="noopener noreferrer"
              download={!isPdf ? att.file_name : undefined}
              className="truncate hover:underline text-foreground"
              title={att.file_name}
            >
              {att.file_name}
            </a>
            <span className="text-muted-foreground shrink-0">{formatFileSize(att.file_size)}</span>
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover/att:opacity-100 transition-opacity"
                onClick={() => onDelete(att.id, att.file_url)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ProgressLog({ entries, onAdd, onUpdate, onDelete, onUploadFiles, onDeleteAttachment, hideTitle = false }: ProgressLogProps) {
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const handleSend = async () => {
    if (!text.trim() && pendingFiles.length === 0) return;
    setSending(true);
    try {
      const content = text.trim() || (pendingFiles.length > 0 ? `📎 ${pendingFiles.length} archivo(s) adjunto(s)` : '');
      const entryId = await onAdd(content);
      if (pendingFiles.length > 0 && onUploadFiles) {
        onUploadFiles(entryId, pendingFiles);
      }
      setText('');
      setPendingFiles([]);
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles(prev => [...prev, ...files]);
    }
    e.target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
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
      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => targetRef.current && applyFormat(targetRef.current, 'bold', value, setValue)} title="Negrita">
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => targetRef.current && applyFormat(targetRef.current, 'italic', value, setValue)} title="Cursiva">
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => targetRef.current && applyFormat(targetRef.current, 'bullet', value, setValue)} title="Viñeta">
        <List className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-2">
      {!hideTitle && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bitácora de avances</p>}

      {entries.length > 0 ? (
        <div ref={scrollContainerRef} className="max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
          <div className="divide-y divide-border">
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
                      onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); }}
                      className="min-h-[60px] text-sm resize-none"
                      autoFocus
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 break-words overflow-hidden">
                        <FormattedText content={entry.content} />
                        <AttachmentList attachments={entry.attachments || []} onDelete={onDeleteAttachment} />
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {onUpdate && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => handleStartEdit(entry)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(entry.id)}>
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
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic py-2">Sin entradas aún. Registra el primer avance.</p>
      )}

      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pendingFiles.map((file, i) => {
            const Icon = getFileIcon(file.type);
            return (
              <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-muted/50 text-xs">
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[120px]">{file.name}</span>
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive" onClick={() => removePendingFile(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <FormatToolbar targetRef={textareaRef} value={text} setValue={setText} />
            {onUploadFiles && (
              <>
                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()} title="Adjuntar archivo">
                  <Paperclip className="h-3.5 w-3.5" />
                </Button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              </>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
              onClick={async () => {
                setSending(true);
                try { await onAdd("**Sin avances esta semana**"); } finally { setSending(false); }
              }}
              disabled={sending}
              title="Registrar sin avances"
            >
              <Ban className="h-3 w-3" />
              Sin avances
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="h-7 shrink-0" onClick={handleSend} disabled={(!text.trim() && pendingFiles.length === 0) || sending}>
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
