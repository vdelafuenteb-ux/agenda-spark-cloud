import { useState, useRef, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft, Trash2, Tag, Bold, Italic, Underline as UnderlineIcon,
  Strikethrough, List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Heading1, Heading2, Heading3, Minus, ImagePlus, FileUp, Type, Undo2, Redo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Note, Notebook, NoteSection } from '@/hooks/useNotes';
import type { Tag as TagType } from '@/hooks/useTags';

interface NoteEditorProps {
  note: Note;
  notebooks: Notebook[];
  sections: NoteSection[];
  allTags: TagType[];
  noteTagIds: string[];
  onUpdate: (id: string, data: { title?: string; content?: string; notebook_id?: string | null; section_id?: string | null }) => void;
  onDelete: (id: string) => void;
  onAddTag: (noteId: string, tagId: string) => void;
  onRemoveTag: (noteId: string, tagId: string) => void;
  onBack: () => void;
  onUploadImage: (file: File) => Promise<string>;
}

function ToolbarButton({ icon: Icon, label, onClick, active }: { icon: any; label: string; onClick: () => void; active?: boolean }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
            className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function NoteEditor({
  note,
  notebooks,
  sections,
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});

  // Manual undo/redo history
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);

  const pushHistory = useCallback(() => {
    if (!editorRef.current || isUndoRedoRef.current) return;
    const html = editorRef.current.innerHTML;
    const history = historyRef.current;
    const idx = historyIndexRef.current;
    // Don't push if same as current
    if (idx >= 0 && history[idx] === html) return;
    // Truncate any future states
    historyRef.current = history.slice(0, idx + 1);
    historyRef.current.push(html);
    // Limit history size
    if (historyRef.current.length > 100) {
      historyRef.current = historyRef.current.slice(-100);
    }
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const handleUndo = useCallback(() => {
    if (!editorRef.current) return;
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current = idx - 1;
    editorRef.current.innerHTML = historyRef.current[idx - 1];
    isUndoRedoRef.current = false;
    handleContentInput();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRedo = useCallback(() => {
    if (!editorRef.current) return;
    const idx = historyIndexRef.current;
    if (idx >= historyRef.current.length - 1) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current = idx + 1;
    editorRef.current.innerHTML = historyRef.current[idx + 1];
    isUndoRedoRef.current = false;
    handleContentInput();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dragState = useRef<{
    type: 'resize' | 'move';
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    aspectRatio: number;
    corner?: string;
    image: HTMLImageElement;
  } | null>(null);

  useEffect(() => {
    setTitle(note.title);
    if (editorRef.current && editorRef.current.innerHTML !== note.content) {
      editorRef.current.innerHTML = note.content;
    }
    // Initialize history with current content
    historyRef.current = [note.content];
    historyIndexRef.current = 0;
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Position overlay on selected image
  const updateOverlay = useCallback((img: HTMLImageElement) => {
    const editor = editorRef.current;
    if (!editor) return;
    const editorRect = editor.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    setOverlayStyle({
      position: 'absolute',
      left: imgRect.left - editorRect.left + editor.scrollLeft,
      top: imgRect.top - editorRect.top + editor.scrollTop,
      width: imgRect.width,
      height: imgRect.height,
      pointerEvents: 'auto',
    });
  }, []);

  // Update overlay position on scroll/resize
  useEffect(() => {
    if (!selectedImage) return;
    const update = () => updateOverlay(selectedImage);
    const editor = editorRef.current;
    editor?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    // Use RAF loop for smooth tracking
    let raf: number;
    const loop = () => { update(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => {
      editor?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      cancelAnimationFrame(raf);
    };
  }, [selectedImage, updateOverlay]);

  // Handle click on editor to select/deselect images
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        e.preventDefault();
        const img = target as HTMLImageElement;
        setSelectedImage(img);
        updateOverlay(img);
      } else {
        setSelectedImage(null);
      }
    };

    editor.addEventListener('click', handleClick);
    return () => editor.removeEventListener('click', handleClick);
  }, [updateOverlay]);

  // Global mouse handlers for drag resize/move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const state = dragState.current;
      if (!state) return;
      e.preventDefault();

      if (state.type === 'resize') {
        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;
        let newWidth = state.startWidth;

        // Calculate new width based on which corner is dragged
        if (state.corner === 'se') {
          newWidth = Math.max(50, state.startWidth + dx);
        } else if (state.corner === 'sw') {
          newWidth = Math.max(50, state.startWidth - dx);
        } else if (state.corner === 'ne') {
          newWidth = Math.max(50, state.startWidth + dx);
        } else if (state.corner === 'nw') {
          newWidth = Math.max(50, state.startWidth - dx);
        }

        const newHeight = newWidth / state.aspectRatio;
        state.image.style.width = `${newWidth}px`;
        state.image.style.height = `${newHeight}px`;
        state.image.style.maxWidth = 'none';
        updateOverlay(state.image);
      } else if (state.type === 'move') {
        // Visual feedback: add opacity while dragging
        state.image.style.opacity = '0.5';
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const state = dragState.current;
      if (!state) return;

      if (state.type === 'move') {
        state.image.style.opacity = '1';
        // Find the drop position using caretRangeFromPoint
        const editor = editorRef.current;
        if (editor) {
          let range: Range | null = null;
          if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(e.clientX, e.clientY);
          } else if ((document as any).caretPositionFromPoint) {
            const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
            if (pos) {
              range = document.createRange();
              range.setStart(pos.offsetNode, pos.offset);
              range.collapse(true);
            }
          }

          if (range && editor.contains(range.startContainer)) {
            // Remove image from current position
            state.image.parentNode?.removeChild(state.image);
            // Insert at new position
            range.insertNode(state.image);
            // Add a br after if needed
            if (!state.image.nextSibling || (state.image.nextSibling as HTMLElement).tagName !== 'BR') {
              const br = document.createElement('br');
              state.image.parentNode?.insertBefore(br, state.image.nextSibling);
            }
          }
        }
      }

      dragState.current = null;
      handleContentInput();
      if (selectedImage) updateOverlay(selectedImage);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectedImage, updateOverlay]); // eslint-disable-line react-hooks/exhaustive-deps

  const startResize = (corner: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImage) return;
    const rect = selectedImage.getBoundingClientRect();
    dragState.current = {
      type: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      aspectRatio: rect.width / rect.height,
      corner,
      image: selectedImage,
    };
  };

  const startMove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImage) return;
    const rect = selectedImage.getBoundingClientRect();
    dragState.current = {
      type: 'move',
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      aspectRatio: rect.width / rect.height,
      image: selectedImage,
    };
  };

  const deleteSelectedImage = () => {
    if (!selectedImage) return;
    selectedImage.parentNode?.removeChild(selectedImage);
    setSelectedImage(null);
    handleContentInput();
  };

  const saveContent = useCallback(() => {
    if (!editorRef.current) return;
    onUpdate(note.id, { content: editorRef.current.innerHTML });
  }, [note.id, onUpdate]);

  const handleContentInput = () => {
    clearTimeout(saveTimeout.current);
    // Push to undo history
    pushHistory();
    saveTimeout.current = setTimeout(saveContent, 800);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => onUpdate(note.id, { title: val }), 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Intercept Ctrl+Z / Ctrl+Y for manual undo/redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      handleRedo();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      setTimeout(handleContentInput, 50);
    }
    // Delete selected image with Delete/Backspace
    if (selectedImage && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      deleteSelectedImage();
    }
  };

  const execCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleContentInput();
  };

  const handleFontSize = (size: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    editorRef.current?.focus();
    document.execCommand('fontSize', false, size);
    handleContentInput();
  };

  const insertHorizontalRule = () => {
    execCommand('insertHorizontalRule');
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // Check if there's text/html or text/plain content (e.g. pasting from Word)
    const hasText = Array.from(items).some(
      (item) => item.type === 'text/html' || item.type === 'text/plain'
    );

    // Only handle as image if there's NO text content (pure image paste/screenshot)
    if (!hasText) {
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          try {
            const url = await onUploadImage(file);
            insertImageAtCursor(url);
            handleContentInput();
          } catch { /* silently fail */ }
          return;
        }
      }
    }
    // Otherwise let the browser handle the paste naturally (text/html from Word, etc.)
  };

  const insertImageAtCursor = (url: string) => {
    const img = document.createElement('img');
    img.src = url;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '8px';
    img.style.margin = '8px 0';
    img.style.cursor = 'pointer';
    img.draggable = false; // We handle our own dragging

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      const br = document.createElement('br');
      range.setStartAfter(img);
      range.insertNode(br);
      range.setStartAfter(br);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editorRef.current?.appendChild(img);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await onUploadImage(file);
      editorRef.current?.focus();
      insertImageAtCursor(url);
      handleContentInput();
    } catch { /* silently fail */ }
    e.target.value = '';
  };

  const handleFileInsert = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    editorRef.current?.focus();
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      document.execCommand('insertText', false, text);
      handleContentInput();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const noteTags = allTags.filter((t) => noteTagIds.includes(t.id));
  const availableTags = allTags.filter((t) => !noteTagIds.includes(t.id));

  const handleCorners = ['nw', 'ne', 'sw', 'se'] as const;
  const cornerCursors: Record<string, string> = {
    nw: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', se: 'nwse-resize',
  };
  const cornerPositions: Record<string, React.CSSProperties> = {
    nw: { top: -5, left: -5 },
    ne: { top: -5, right: -5 },
    sw: { bottom: -5, left: -5 },
    se: { bottom: -5, right: -5 },
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0 overflow-x-auto">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(note.created_at), "d MMM yyyy, HH:mm", { locale: es })}
        </span>
        <div className="flex-1" />
        <Select
          value={note.notebook_id ?? '__none__'}
          onValueChange={(v) => {
            const newNotebookId = v === '__none__' ? null : v;
            onUpdate(note.id, { notebook_id: newNotebookId, section_id: newNotebookId !== note.notebook_id ? null : note.section_id });
          }}
        >
          <SelectTrigger className="h-7 w-24 sm:w-32 text-xs shrink-0">
            <SelectValue placeholder="Sin libreta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-xs">Sin libreta</SelectItem>
            {notebooks.map((nb) => (
              <SelectItem key={nb.id} value={nb.id} className="text-xs">{nb.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {note.notebook_id && (() => {
          const nbSections = sections.filter((s) => s.notebook_id === note.notebook_id);
          if (nbSections.length === 0) return null;
          return (
            <Select
              value={note.section_id ?? '__none__'}
              onValueChange={(v) => onUpdate(note.id, { section_id: v === '__none__' ? null : v })}
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue placeholder="Sin tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs">Sin tema</SelectItem>
                {nbSections.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })()}
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
                  <Badge key={t.id} variant="secondary" className="text-[10px] cursor-pointer hover:line-through"
                    style={{ backgroundColor: t.color + '22', color: t.color, borderColor: t.color + '44' }}
                    onClick={() => onRemoveTag(note.id, t.id)}>
                    {t.name} ×
                  </Badge>
                ))}
              </div>
            )}
            {availableTags.length === 0 && noteTags.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-2">No hay etiquetas</p>
            )}
            {availableTags.map((t) => (
              <button key={t.id} className="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted flex items-center gap-2"
                onClick={() => onAddTag(note.id, t.id)}>
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

      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1 border-b border-border shrink-0 flex-wrap overflow-x-auto">
        <ToolbarButton icon={Undo2} label="Deshacer" onClick={handleUndo} />
        <ToolbarButton icon={Redo2} label="Rehacer" onClick={handleRedo} />
        <Separator orientation="vertical" className="h-5 mx-1" />
        <ToolbarButton icon={Bold} label="Negrita" onClick={() => execCommand('bold')} />
        <ToolbarButton icon={Italic} label="Cursiva" onClick={() => execCommand('italic')} />
        <ToolbarButton icon={UnderlineIcon} label="Subrayado" onClick={() => execCommand('underline')} />
        <ToolbarButton icon={Strikethrough} label="Tachado" onClick={() => execCommand('strikeThrough')} />
        <Separator orientation="vertical" className="h-5 mx-1" />
        <ToolbarButton icon={Heading1} label="Título 1" onClick={() => execCommand('formatBlock', 'h1')} />
        <ToolbarButton icon={Heading2} label="Título 2" onClick={() => execCommand('formatBlock', 'h2')} />
        <ToolbarButton icon={Heading3} label="Título 3" onClick={() => execCommand('formatBlock', 'h3')} />
        <ToolbarButton icon={Type} label="Párrafo" onClick={() => execCommand('formatBlock', 'p')} />
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Select onValueChange={handleFontSize} defaultValue="3">
          <SelectTrigger className="h-7 w-20 text-[10px]">
            <SelectValue placeholder="Tamaño" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1" className="text-[10px]">Muy pequeño</SelectItem>
            <SelectItem value="2" className="text-[10px]">Pequeño</SelectItem>
            <SelectItem value="3" className="text-[10px]">Normal</SelectItem>
            <SelectItem value="4" className="text-[10px]">Mediano</SelectItem>
            <SelectItem value="5" className="text-[10px]">Grande</SelectItem>
            <SelectItem value="6" className="text-[10px]">Muy grande</SelectItem>
            <SelectItem value="7" className="text-[10px]">Enorme</SelectItem>
          </SelectContent>
        </Select>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <ToolbarButton icon={List} label="Viñetas" onClick={() => execCommand('insertUnorderedList')} />
        <ToolbarButton icon={ListOrdered} label="Lista numerada" onClick={() => execCommand('insertOrderedList')} />
        <Separator orientation="vertical" className="h-5 mx-1" />
        <ToolbarButton icon={AlignLeft} label="Alinear izquierda" onClick={() => execCommand('justifyLeft')} />
        <ToolbarButton icon={AlignCenter} label="Centrar" onClick={() => execCommand('justifyCenter')} />
        <ToolbarButton icon={AlignRight} label="Alinear derecha" onClick={() => execCommand('justifyRight')} />
        <Separator orientation="vertical" className="h-5 mx-1" />
        <ToolbarButton icon={Minus} label="Línea horizontal" onClick={insertHorizontalRule} />
        <ToolbarButton icon={ImagePlus} label="Insertar imagen" onClick={() => imageInputRef.current?.click()} />
        <ToolbarButton icon={FileUp} label="Insertar texto desde archivo" onClick={() => fileInputRef.current?.click()} />
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.json" className="hidden" onChange={handleFileInsert} />
      </div>

      {/* Selected image toolbar */}
      {selectedImage && (
        <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-muted/30 shrink-0">
          <span className="text-[10px] text-muted-foreground">Imagen seleccionada — arrastra las esquinas para redimensionar, o arrastra la imagen para moverla</span>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-destructive"
            onMouseDown={(e) => { e.preventDefault(); deleteSelectedImage(); }}>
            Eliminar imagen
          </Button>
        </div>
      )}

      {/* Title */}
      <div className="px-4 pt-3">
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
            <Badge key={t.id} variant="secondary" className="text-[9px] h-4"
              style={{ backgroundColor: t.color + '22', color: t.color }}>
              {t.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Content editor - relative container for overlay */}
      <div className="flex-1 overflow-auto relative" style={{ minHeight: 200 }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="h-full px-4 py-3 text-sm text-foreground outline-none prose prose-sm max-w-none
            [&_img]:rounded-lg [&_img]:max-w-full [&_img]:cursor-pointer
            [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:mt-4
            [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3
            [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mb-1 [&_h3]:mt-2
            [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
            [&_hr]:my-4 [&_hr]:border-border"
          onInput={handleContentInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          
          data-placeholder="Empieza a escribir..."
        />

        {/* Image overlay with resize handles */}
        {selectedImage && (
          <div
            style={overlayStyle}
            className="border-2 border-primary rounded-lg z-10"
            onMouseDown={startMove}
          >
            {/* Move cursor area */}
            <div className="absolute inset-3 cursor-move" />

            {/* Corner handles */}
            {handleCorners.map((corner) => (
              <div
                key={corner}
                className="absolute w-3 h-3 bg-primary rounded-full border-2 border-background shadow-md z-20"
                style={{
                  ...cornerPositions[corner],
                  cursor: cornerCursors[corner],
                }}
                onMouseDown={(e) => startResize(corner, e)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
