import { useState } from 'react';
import { Plus, FolderOpen, MoreHorizontal, Pencil, Trash2, StickyNote, ChevronRight, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import type { Notebook, NoteSection, Note } from '@/hooks/useNotes';

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6b7280'];

interface SectionListProps {
  notebook: Notebook;
  sections: NoteSection[];
  notes: Note[];
  onBack: () => void;
  onSelectSection: (sectionId: string) => void;
  onCreateSection: (data: { notebook_id: string; name: string; color?: string }) => void;
  onDeleteSection: (id: string) => void;
  onUpdateSection: (id: string, data: { name?: string; color?: string }) => void;
  onCreateNote: (data: { notebook_id: string; section_id?: string | null }) => void;
  onShowUnsectioned: () => void;
  onSelectNote?: (noteId: string) => void;
}

export function SectionList({ notebook, sections, notes, onBack, onSelectSection, onCreateSection, onDeleteSection, onUpdateSection, onCreateNote, onShowUnsectioned }: SectionListProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateSection({ notebook_id: notebook.id, name: newName.trim(), color: newColor });
    setNewName('');
    setNewColor(COLORS[0]);
    setCreateOpen(false);
  };

  const nbSections = sections.filter((s) => s.notebook_id === notebook.id);
  const unsectionedNotes = notes.filter((n) => n.notebook_id === notebook.id && !n.section_id);

  const getNoteCount = (sectionId: string) => notes.filter((n) => n.section_id === sectionId).length;

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="cursor-pointer text-xs" onClick={onBack}>📚 Libretas</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator><ChevronRight className="h-3 w-3" /></BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-xs font-medium">{notebook.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: notebook.color + '20' }}>
            <FolderOpen className="h-5 w-5" style={{ color: notebook.color }} />
          </div>
          <div>
            <h2 className="text-lg font-bold">{notebook.name}</h2>
            <p className="text-xs text-muted-foreground">{nbSections.length} tema{nbSections.length !== 1 ? 's' : ''} · {notes.filter(n => n.notebook_id === notebook.id).length} notas</p>
          </div>
        </div>
        <Popover open={createOpen} onOpenChange={setCreateOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Nuevo tema
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3">
            <Input
              placeholder="Nombre del tema"
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

      {/* Sections grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {nbSections.map((sec) => {
          const nCount = getNoteCount(sec.id);
          return (
            <div
              key={sec.id}
              onClick={() => onSelectSection(sec.id)}
              className="group relative rounded-xl border bg-card p-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200"
            >
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => {
                      const name = prompt('Nuevo nombre:', sec.name);
                      if (name) onUpdateSection(sec.id, { name });
                    }}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Renombrar
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => onDeleteSection(sec.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: sec.color + '20' }}>
                  <FolderOpen className="h-4 w-4" style={{ color: sec.color }} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-sm truncate">{sec.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <StickyNote className="h-3 w-3" />{nCount} nota{nCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unsectioned notes */}
      {unsectionedNotes.length > 0 && (
        <div
          onClick={onShowUnsectioned}
          className="rounded-xl border border-dashed bg-muted/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <StickyNote className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Notas sin tema</h3>
              <p className="text-xs text-muted-foreground">{unsectionedNotes.length} nota{unsectionedNotes.length !== 1 ? 's' : ''} sin clasificar</p>
            </div>
          </div>
        </div>
      )}

      {nbSections.length === 0 && unsectionedNotes.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay temas en esta libreta</p>
          <p className="text-xs text-muted-foreground mt-1">Crea un tema para organizar tus notas</p>
        </div>
      )}
    </div>
  );
}
