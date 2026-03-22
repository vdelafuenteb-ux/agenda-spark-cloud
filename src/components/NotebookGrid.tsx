import { useState } from 'react';
import { Plus, BookOpen, MoreHorizontal, Pencil, Trash2, StickyNote, FolderOpen } from 'lucide-react';
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
  onCreateNotebook: (data: { name: string; color: string }) => void;
  onDeleteNotebook: (id: string) => void;
  onUpdateNotebook: (id: string, data: { name?: string; color?: string }) => void;
  onShowAllNotes: () => void;
}

export function NotebookGrid({ notebooks, sections, notes, onSelect, onCreateNotebook, onDeleteNotebook, onUpdateNotebook, onShowAllNotes }: NotebookGridProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateNotebook({ name: newName.trim(), color: newColor });
    setNewName('');
    setNewColor(COLORS[0]);
    setCreateOpen(false);
  };

  const getSectionCount = (nbId: string) => sections.filter((s) => s.notebook_id === nbId).length;
  const getNoteCount = (nbId: string) => notes.filter((n) => n.notebook_id === nbId).length;
  const getLastUpdate = (nbId: string) => {
    const nbNotes = notes.filter((n) => n.notebook_id === nbId);
    if (nbNotes.length === 0) return null;
    return nbNotes.reduce((latest, n) => (n.updated_at > latest ? n.updated_at : latest), nbNotes[0].updated_at);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">📚 Libretas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Selecciona una libreta para ver sus temas y notas</p>
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
          return (
            <div
              key={nb.id}
              onClick={() => onSelect(nb.id)}
              className="group relative rounded-xl border bg-card p-5 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200"
            >
              {/* Dropdown */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  <h3 className="font-semibold text-sm truncate">{nb.name}</h3>
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
    </div>
  );
}
