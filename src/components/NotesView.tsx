import { useState, useMemo } from 'react';
import { Plus, Search, StickyNote, ChevronRight, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { NotebookGrid } from '@/components/NotebookGrid';
import { SectionList } from '@/components/SectionList';
import { NoteEditor } from '@/components/NoteEditor';
import { useNotes } from '@/hooks/useNotes';
import { useTags } from '@/hooks/useTags';
import { toast } from 'sonner';

type ViewLevel = 'notebooks' | 'sections' | 'notes' | 'editor' | 'all-notes';

export function NotesView() {
  const {
    notebooks, sections, notes, isLoading,
    createNotebook, updateNotebook, deleteNotebook,
    createSection, updateSection, deleteSection,
    createNote, updateNote, deleteNote,
    addNoteTag, removeNoteTag, getTagsForNote,
    uploadImage,
  } = useNotes();
  const { tags } = useTags();

  const [view, setView] = useState<ViewLevel>('notebooks');
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  // null means "unsectioned notes" mode
  const [showUnsectioned, setShowUnsectioned] = useState(false);

  const selectedNotebook = selectedNotebookId ? notebooks.find((nb) => nb.id === selectedNotebookId) : null;
  const selectedSection = selectedSectionId ? sections.find((s) => s.id === selectedSectionId) : null;
  const selectedNote = selectedNoteId ? notes.find((n) => n.id === selectedNoteId) : null;

  // Notes for current context
  const contextNotes = useMemo(() => {
    let filtered: typeof notes = [];

    if (view === 'all-notes') {
      filtered = notes;
    } else if (view === 'notes' && showUnsectioned && selectedNotebookId) {
      filtered = notes.filter((n) => n.notebook_id === selectedNotebookId && !n.section_id);
    } else if (view === 'notes' && selectedSectionId) {
      filtered = notes.filter((n) => n.section_id === selectedSectionId);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().replace(/<[^>]*>/g, '').includes(q)
      );
    }
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter((n) => {
        const tagIds = getTagsForNote(n.id);
        return selectedTagIds.some((id) => tagIds.includes(id));
      });
    }
    return filtered;
  }, [notes, view, selectedSectionId, selectedNotebookId, showUnsectioned, searchQuery, selectedTagIds, getTagsForNote]);

  const handleSelectNotebook = (nbId: string) => {
    setSelectedNotebookId(nbId);
    setView('sections');
  };

  const handleSelectSection = (secId: string) => {
    setSelectedSectionId(secId);
    setShowUnsectioned(false);
    setView('notes');
  };

  const handleShowUnsectioned = () => {
    setSelectedSectionId(null);
    setShowUnsectioned(true);
    setView('notes');
  };

  const handleShowAllNotes = () => {
    setSelectedNotebookId(null);
    setSelectedSectionId(null);
    setShowUnsectioned(false);
    setView('all-notes');
  };

  const handleBackToNotebooks = () => {
    setSelectedNotebookId(null);
    setSelectedSectionId(null);
    setShowUnsectioned(false);
    setView('notebooks');
  };

  const handleBackToSections = () => {
    setSelectedSectionId(null);
    setShowUnsectioned(false);
    setView('sections');
  };

  const handleCreateNote = async () => {
    try {
      const note = await createNote.mutateAsync({
        notebook_id: selectedNotebookId,
        section_id: showUnsectioned ? null : selectedSectionId,
      });
      setSelectedNoteId(note.id);
      setView('editor');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleMoveNote = (noteId: string, notebookId: string, sectionId: string | null) => {
    updateNote.mutate(
      { id: noteId, notebook_id: notebookId, section_id: sectionId },
      { onSuccess: () => toast.success('Nota movida') }
    );
  };

  const handleSelectNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    setView('editor');
  };

  const handleDeleteNote = (id: string) => {
    deleteNote.mutate(id, {
      onSuccess: () => {
        if (selectedNoteId === id) {
          setSelectedNoteId(null);
          // Go back to notes list
          if (selectedSectionId || showUnsectioned) {
            setView('notes');
          } else {
            setView('all-notes');
          }
        }
        toast.success('Nota eliminada');
      },
    });
  };

  const handleEditorBack = () => {
    setSelectedNoteId(null);
    if (selectedSectionId || showUnsectioned) {
      setView('notes');
    } else if (selectedNotebookId) {
      setView('sections');
    } else {
      setView('notebooks');
    }
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Cargando notas...</p>;
  }

  // EDITOR VIEW
  if (view === 'editor' && selectedNote) {
    return (
      <div className="flex h-[calc(100vh-48px)] overflow-hidden">
        <div className="flex-1 min-w-0 flex">
          <NoteEditor
            key={selectedNote.id}
            note={selectedNote}
            notebooks={notebooks}
            sections={sections}
            allTags={tags}
            noteTagIds={getTagsForNote(selectedNote.id)}
            onUpdate={(id, data) => updateNote.mutate({ id, ...data })}
            onDelete={handleDeleteNote}
            onAddTag={(noteId, tagId) => addNoteTag.mutate({ note_id: noteId, tag_id: tagId })}
            onRemoveTag={(noteId, tagId) => removeNoteTag.mutate({ note_id: noteId, tag_id: tagId })}
            onBack={handleEditorBack}
            onUploadImage={uploadImage}
            onCreateSection={(data) => createSection.mutateAsync(data)}
          />
        </div>
      </div>
    );
  }

  // NOTEBOOKS GRID VIEW
  if (view === 'notebooks') {
    return (
      <ScrollArea className="h-[calc(100vh-48px)]">
        <NotebookGrid
          notebooks={notebooks}
          sections={sections}
          notes={notes}
          onSelect={handleSelectNotebook}
          onSelectSection={(nbId, secId) => {
            setSelectedNotebookId(nbId);
            handleSelectSection(secId);
          }}
          onSelectNote={handleSelectNote}
          onCreateNotebook={(data) => createNotebook.mutate(data, { onSuccess: () => toast.success('Libreta creada') })}
          onCreateSection={(data) => createSection.mutate(data, { onSuccess: () => toast.success('Tema creado') })}
          onDeleteNotebook={(id) => deleteNotebook.mutate(id, { onSuccess: () => toast.success('Libreta eliminada') })}
          onUpdateNotebook={(id, data) => updateNotebook.mutate({ id, ...data })}
          onShowAllNotes={handleShowAllNotes}
          onMoveNote={handleMoveNote}
          onQuickNote={async () => {
            try {
              const note = await createNote.mutateAsync({ notebook_id: null, section_id: null });
              setSelectedNoteId(note.id);
              setView('editor');
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
        />
      </ScrollArea>
    );
  }

  // SECTIONS VIEW
  if (view === 'sections' && selectedNotebook) {
    return (
      <ScrollArea className="h-[calc(100vh-48px)]">
        <SectionList
          notebook={selectedNotebook}
          sections={sections}
          notes={notes}
          onBack={handleBackToNotebooks}
          onSelectSection={handleSelectSection}
          onCreateSection={(data) => createSection.mutate(data, { onSuccess: () => toast.success('Tema creado') })}
          onDeleteSection={(id) => deleteSection.mutate(id, { onSuccess: () => toast.success('Tema eliminado') })}
          onUpdateSection={(id, data) => updateSection.mutate({ id, ...data })}
          onCreateNote={(data) => {
            createNote.mutateAsync(data).then((note) => {
              setSelectedNoteId(note.id);
              setView('editor');
            });
          }}
          onShowUnsectioned={handleShowUnsectioned}
          onSelectNote={handleSelectNote}
        />
      </ScrollArea>
    );
  }

  // NOTES LIST VIEW (within a section, unsectioned, or all notes)
  const breadcrumbTitle = view === 'all-notes'
    ? 'Todas las notas'
    : showUnsectioned
    ? 'Sin tema'
    : selectedSection?.name ?? '';

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink className="cursor-pointer text-xs" onClick={handleBackToNotebooks}>📚 Libretas</BreadcrumbLink>
            </BreadcrumbItem>
            {selectedNotebook && (
              <>
                <BreadcrumbSeparator><ChevronRight className="h-3 w-3" /></BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbLink className="cursor-pointer text-xs" onClick={handleBackToSections}>{selectedNotebook.name}</BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            <BreadcrumbSeparator><ChevronRight className="h-3 w-3" /></BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-xs font-medium">{breadcrumbTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={view === 'all-notes' ? handleBackToNotebooks : handleBackToSections}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-base font-semibold">{breadcrumbTitle}</h2>
            <span className="text-xs text-muted-foreground">({contextNotes.length})</span>
          </div>
          <Button size="sm" className="gap-1.5 text-xs" onClick={handleCreateNote}>
            <Plus className="h-3.5 w-3.5" /> Nueva nota
          </Button>
        </div>

        {/* Search + tag filters */}
        <div className="flex flex-col gap-2">
          <div className="relative max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs pl-7"
            />
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTagIds.includes(tag.id) ? 'default' : 'outline'}
                  className="text-[9px] cursor-pointer h-5"
                  style={
                    selectedTagIds.includes(tag.id)
                      ? { backgroundColor: tag.color, borderColor: tag.color, color: '#fff' }
                      : { borderColor: tag.color + '66', color: tag.color }
                  }
                  onClick={() => toggleTagFilter(tag.id)}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notes grid */}
      <ScrollArea className="flex-1">
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {contextNotes.map((note) => {
            const preview = note.content.replace(/<[^>]*>/g, '').slice(0, 120);
            const noteTagIds = getTagsForNote(note.id);
            const noteTagsList = tags.filter((t) => noteTagIds.includes(t.id));
            return (
              <div
                key={note.id}
                onClick={() => handleSelectNote(note.id)}
                className="rounded-lg border bg-card p-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
              >
                <p className="text-sm font-medium truncate">{note.title || 'Sin título'}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{preview || 'Nota vacía'}</p>
                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border">
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(note.updated_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </span>
                  <div className="flex gap-0.5 ml-auto">
                    {noteTagsList.slice(0, 3).map((t) => (
                      <span key={t.id} className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {contextNotes.length === 0 && (
          <div className="text-center py-16">
            <StickyNote className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No hay notas</p>
            <Button size="sm" className="mt-3 text-xs gap-1" onClick={handleCreateNote}>
              <Plus className="h-3 w-3" /> Nueva nota
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
