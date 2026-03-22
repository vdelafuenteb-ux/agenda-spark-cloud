import { useState } from 'react';
import { Plus, BookOpen, MoreHorizontal, Pencil, Trash2, StickyNote, FolderOpen, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Notebook, NoteSection, Note } from '@/hooks/useNotes';

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6b7280'];

interface NotebookGridProps {
  notebooks: Notebook[];
  sections: NoteSection[];
  notes: Note[];
  onSelect: (notebookId: string) => void;
  onSelectSection?: (notebookId: string, sectionId: string) => void;
  onSelectNote?: (noteId: string) => void;
  onCreateNotebook: (data: { name: string; color: string }) => void;
  onCreateSection?: (data: { notebook_id: string; name: string }) => void;
  onDeleteNotebook: (id: string) => void;
  onUpdateNotebook: (id: string, data: { name?: string; color?: string }) => void;
  onShowAllNotes: () => void;
  onMoveNote?: (noteId: string, notebookId: string, sectionId: string | null) => void;
}

export function NotebookGrid({ notebooks, sections, notes, onSelect, onSelectSection, onSelectNote, onCreateNotebook, onCreateSection, onDeleteNotebook, onUpdateNotebook, onShowAllNotes, onMoveNote }: NotebookGridProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<string>>(new Set());
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [addingSectionTo, setAddingSectionTo] = useState<string | null>(null);
  const [showAllUnassigned, setShowAllUnassigned] = useState(false);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateNotebook({ name: newName.trim(), color: newColor });
    setNewName('');
    setNewColor(COLORS[0]);
    setCreateOpen(false);
  };

  const toggleExpand = (nbId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNotebooks(prev => {
      const next = new Set(prev);
      if (next.has(nbId)) next.delete(nbId);
      else next.add(nbId);
      return next;
    });
  };

  const getSectionCount = (nbId: string) => sections.filter((s) => s.notebook_id === nbId).length;
  const getNoteCount = (nbId: string) => notes.filter((n) => n.notebook_id === nbId).length;
  const getLastUpdate = (nbId: string) => {
    const nbNotes = notes.filter((n) => n.notebook_id === nbId);
    if (nbNotes.length === 0) return null;
    return nbNotes.reduce((latest, n) => (n.updated_at > latest ? n.updated_at : latest), nbNotes[0].updated_at);
  };

  const unassignedNotes = notes.filter(n => !n.notebook_id);
  const visibleUnassigned = showAllUnassigned ? unassignedNotes : unassignedNotes.slice(0, 6);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, noteId: string) => {
    e.dataTransfer.setData('text/plain', noteId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(targetId);
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDropOnNotebook = (e: React.DragEvent, notebookId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    const noteId = e.dataTransfer.getData('text/plain');
    if (noteId && onMoveNote) onMoveNote(noteId, notebookId, null);
  };

  const handleDropOnSection = (e: React.DragEvent, notebookId: string, sectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    const noteId = e.dataTransfer.getData('text/plain');
    if (noteId && onMoveNote) onMoveNote(noteId, notebookId, sectionId);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">📚 Libretas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Selecciona una libreta o arrastra notas sueltas para organizarlas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onShowAllNotes}>
            <StickyNote className="h-3.5 w-3.5" /> Todas las notas
          </Button>
          <Popover open={createOpen} onOpenChange={setCreateOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Nueva libreta
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3">
              <Input
                placeholder="Nombre de la libreta"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`h-6 w-6 rounded-full border-2 transition-transform ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Button size="sm" className="w-full text-xs" onClick={handleCreate}>Crear</Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {notebooks.map((nb) => {
          const sCount = getSectionCount(nb.id);
          const nCount = getNoteCount(nb.id);
          const lastUp = getLastUpdate(nb.id);
          const isExpanded = expandedNotebooks.has(nb.id);
          const nbSections = sections.filter(s => s.notebook_id === nb.id);
          const isDragOver = dragOverTarget === `nb-${nb.id}`;

          return (
            <div key={nb.id} className="space-y-0">
              <div
                onClick={() => onSelect(nb.id)}
                onDragOver={(e) => handleDragOver(e, `nb-${nb.id}`)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDropOnNotebook(e, nb.id)}
                className={`group relative rounded-xl border bg-card p-5 cursor-pointer hover:shadow-md transition-all duration-200 ${
                  isDragOver ? 'border-primary ring-2 ring-primary/20 shadow-lg' : 'hover:border-primary/30'
                }`}
              >
                {/* Dropdown */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => toggleExpand(nb.id, e)}
                  >
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => {
                        const name = prompt('Nuevo nombre:', nb.name);
                        if (name) onUpdateNotebook(nb.id, { name });
                      }}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Renombrar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => onDeleteNotebook(nb.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Icon + Title */}
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: nb.color + '20' }}>
                    <BookOpen className="h-5 w-5" style={{ color: nb.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => toggleExpand(nb.id, e)} className="shrink-0">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                      <h3 className="font-semibold text-sm truncate">{nb.name}</h3>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{sCount} tema{sCount !== 1 ? 's' : ''}</span>
                      <span className="flex items-center gap-1"><StickyNote className="h-3 w-3" />{nCount} nota{nCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                {lastUp && (
                  <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border">
                    Última edición: {format(new Date(lastUp), "d MMM yyyy", { locale: es })}
                  </p>
                )}
              </div>

              {/* Expanded sections as drop targets */}
              {isExpanded && (
                <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-border pl-3 py-1">
                  {nbSections.map(sec => {
                    const secDragOver = dragOverTarget === `sec-${sec.id}`;
                    const secNoteCount = notes.filter(n => n.section_id === sec.id).length;
                    return (
                      <div
                        key={sec.id}
                        onClick={() => onSelectSection?.(nb.id, sec.id)}
                        onDragOver={(e) => handleDragOver(e, `sec-${sec.id}`)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropOnSection(e, nb.id, sec.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs cursor-pointer transition-all ${
                          secDragOver ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'
                        }`}
                      >
                        <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color: sec.color }} />
                        <span className="truncate font-medium">{sec.name}</span>
                        <span className="text-muted-foreground ml-auto shrink-0">{secNoteCount}</span>
                      </div>
                    );
                  })}
                  {/* Inline add section */}
                  {addingSectionTo === nb.id ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                      <Input
                        autoFocus
                        placeholder="Nombre del tema"
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        className="h-7 text-xs flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newSectionName.trim()) {
                            onCreateSection?.({ notebook_id: nb.id, name: newSectionName.trim() });
                            setNewSectionName('');
                            setAddingSectionTo(null);
                          }
                          if (e.key === 'Escape') { setAddingSectionTo(null); setNewSectionName(''); }
                        }}
                      />
                      <Button size="sm" className="h-7 text-xs px-2" onClick={() => {
                        if (newSectionName.trim()) {
                          onCreateSection?.({ notebook_id: nb.id, name: newSectionName.trim() });
                          setNewSectionName('');
                          setAddingSectionTo(null);
                        }
                      }}>OK</Button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setAddingSectionTo(nb.id); }}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 w-full transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Nuevo tema
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {notebooks.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay libretas aún</p>
          <p className="text-xs text-muted-foreground mt-1">Crea tu primera libreta para organizar tus notas</p>
        </div>
      )}

      {/* Unassigned notes */}
      {unassignedNotes.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">📋 Notas sin asignar</h3>
              <span className="text-xs text-muted-foreground">({unassignedNotes.length})</span>
            </div>
            {unassignedNotes.length > 6 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowAllUnassigned(!showAllUnassigned)}>
                {showAllUnassigned ? 'Ver menos' : `Ver todas (${unassignedNotes.length})`}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {visibleUnassigned.map(note => {
              const preview = note.content.replace(/<[^>]*>/g, '').slice(0, 60);
              return (
                <div
                  key={note.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, note.id)}
                  className="rounded-lg border border-dashed border-border bg-card p-3 cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all duration-150 select-none"
                  onClick={() => onSelectNote?.(note.id)}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{note.title || 'Sin título'}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{preview || 'Nota vacía'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
