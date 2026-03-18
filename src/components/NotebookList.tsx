import { useState } from 'react';
import { Book, Plus, MoreHorizontal, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Notebook, Note } from '@/hooks/useNotes';

const NOTEBOOK_COLORS = ['#6b7280', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

interface NotebookListProps {
  notebooks: Notebook[];
  notes: Note[];
  selectedNotebookId: string | null; // null = all notes
  onSelect: (id: string | null) => void;
  onCreateNotebook: (data: { name: string; color: string }) => void;
  onDeleteNotebook: (id: string) => void;
  onUpdateNotebook: (id: string, data: { name?: string; color?: string }) => void;
}

export function NotebookList({
  notebooks,
  notes,
  selectedNotebookId,
  onSelect,
  onCreateNotebook,
  onDeleteNotebook,
  onUpdateNotebook,
}: NotebookListProps) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(NOTEBOOK_COLORS[0]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const countNotes = (notebookId: string | null) =>
    notebookId === null ? notes.length : notes.filter((n) => n.notebook_id === notebookId).length;

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateNotebook({ name: newName.trim(), color: newColor });
    setNewName('');
    setNewColor(NOTEBOOK_COLORS[0]);
    setCreateOpen(false);
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    onUpdateNotebook(id, { name: editName.trim() });
    setEditingId(null);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Libretas</span>
        <Popover open={createOpen} onOpenChange={setCreateOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 space-y-2" align="start">
            <Input
              placeholder="Nombre de la libreta"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="h-8 text-xs"
            />
            <div className="flex gap-1 flex-wrap">
              {NOTEBOOK_COLORS.map((c) => (
                <button
                  key={c}
                  className={`h-5 w-5 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate} disabled={!newName.trim()}>
              Crear
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* All notes */}
      <button
        onClick={() => onSelect(null)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
          selectedNotebookId === null ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground hover:bg-muted'
        }`}
      >
        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate flex-1 text-left">Todas las notas</span>
        <span className="text-muted-foreground text-[10px]">{countNotes(null)}</span>
      </button>

      {notebooks.map((nb) => (
        <div key={nb.id} className="group flex items-center">
          {editingId === nb.id ? (
            <Input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(nb.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              onBlur={() => handleRename(nb.id)}
              className="h-7 text-xs flex-1"
            />
          ) : (
            <button
              onClick={() => onSelect(nb.id)}
              className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                selectedNotebookId === nb.id ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground hover:bg-muted'
              }`}
            >
              <Book className="h-3.5 w-3.5 shrink-0" style={{ color: nb.color }} />
              <span className="truncate flex-1 text-left">{nb.name}</span>
              <span className="text-muted-foreground text-[10px]">{countNotes(nb.id)}</span>
            </button>
          )}

          {editingId !== nb.id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem
                  className="text-xs"
                  onClick={() => {
                    setEditingId(nb.id);
                    setEditName(nb.name);
                  }}
                >
                  <Pencil className="h-3 w-3 mr-2" /> Renombrar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs text-destructive" onClick={() => onDeleteNotebook(nb.id)}>
                  <Trash2 className="h-3 w-3 mr-2" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ))}
    </div>
  );
}
