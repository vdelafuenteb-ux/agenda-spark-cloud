import { useState, useRef, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Note, Notebook } from '@/hooks/useNotes';
import type { Tag as TagType } from '@/hooks/useTags';

interface NoteEditorProps {
  note: Note;
  notebooks: Notebook[];
  allTags: TagType[];
  noteTagIds: string[];
  onUpdate: (id: string, data: { title?: string; content?: string; notebook_id?: string | null }) => void;
  onDelete: (id: string) => void;
  onAddTag: (noteId: string, tagId: string) => void;
  onRemoveTag: (noteId: string, tagId: string) => void;
  onBack: () => void;
  onUploadImage: (file: File) => Promise<string>;
}

export function NoteEditor({
  note,
  notebooks,
  allTags,
  noteTagIds,
  onUpdate,
  onDelete,
  onAddTag,
  onRemoveTag,
  onBack,
  onUploadImage,
}: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Sync when note changes
  useEffect(() => {
    setTitle(note.title);
    if (editorRef.current && editorRef.current.innerHTML !== note.content) {
      editorRef.current.innerHTML = note.content;
    }
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveContent = useCallback(() => {
    if (!editorRef.current) return;
    onUpdate(note.id, { content: editorRef.current.innerHTML });
  }, [note.id, onUpdate]);

  const handleContentInput = () => {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(saveContent, 800);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => onUpdate(note.id, { title: val }), 800);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        try {
          const url = await onUploadImage(file);
          const img = document.createElement('img');
          img.src = url;
          img.style.maxWidth = '100%';
          img.style.borderRadius = '8px';
          img.style.margin = '8px 0';
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            range.setStartAfter(img);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            editorRef.current?.appendChild(img);
          }
          handleContentInput();
        } catch {
          // silently fail
        }
        return;
      }
    }
  };

  const noteTags = allTags.filter((t) => noteTagIds.includes(t.id));
  const availableTags = allTags.filter((t) => !noteTagIds.includes(t.id));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <span className="text-[10px] text-muted-foreground">
          {format(new Date(note.created_at), "d MMM yyyy, HH:mm", { locale: es })}
        </span>

        <div className="flex-1" />

        {/* Notebook selector */}
        <Select
          value={note.notebook_id ?? '__none__'}
          onValueChange={(v) => onUpdate(note.id, { notebook_id: v === '__none__' ? null : v })}
        >
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue placeholder="Sin libreta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-xs">Sin libreta</SelectItem>
            {notebooks.map((nb) => (
              <SelectItem key={nb.id} value={nb.id} className="text-xs">{nb.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tags */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Tag className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2 space-y-1" align="end">
            {noteTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pb-1 border-b border-border mb-1">
                {noteTags.map((t) => (
                  <Badge
                    key={t.id}
                    variant="secondary"
                    className="text-[10px] cursor-pointer hover:line-through"
                    style={{ backgroundColor: t.color + '22', color: t.color, borderColor: t.color + '44' }}
                    onClick={() => onRemoveTag(note.id, t.id)}
                  >
                    {t.name} ×
                  </Badge>
                ))}
              </div>
            )}
            {availableTags.length === 0 && noteTags.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-2">No hay etiquetas</p>
            )}
            {availableTags.map((t) => (
              <button
                key={t.id}
                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted flex items-center gap-2"
                onClick={() => onAddTag(note.id, t.id)}
              >
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                {t.name}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(note.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Title */}
      <div className="px-4 pt-4">
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Título de la nota"
          className="border-0 px-0 text-lg font-semibold focus-visible:ring-0 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Tags display */}
      {noteTags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 pt-1">
          {noteTags.map((t) => (
            <Badge
              key={t.id}
              variant="secondary"
              className="text-[9px] h-4"
              style={{ backgroundColor: t.color + '22', color: t.color }}
            >
              {t.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Content editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="flex-1 overflow-auto px-4 py-3 text-sm text-foreground outline-none prose prose-sm max-w-none [&_img]:rounded-lg [&_img]:max-w-full"
        onInput={handleContentInput}
        onPaste={handlePaste}
        dangerouslySetInnerHTML={{ __html: note.content }}
        data-placeholder="Empieza a escribir..."
        style={{ minHeight: 200 }}
      />
    </div>
  );
}
