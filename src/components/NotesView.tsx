import { useState, useMemo } from 'react';
import { Plus, Search, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotebookList } from '@/components/NotebookList';
import { NoteEditor } from '@/components/NoteEditor';
import { useNotes } from '@/hooks/useNotes';
import { useTags } from '@/hooks/useTags';
import { toast } from 'sonner';

export function NotesView() {
  const {
    notebooks, notes, isLoading,
    createNotebook, updateNotebook, deleteNotebook,
    createNote, updateNote, deleteNote,
    addNoteTag, removeNoteTag, getTagsForNote,
    uploadImage,
  } = useNotes();
  const { tags } = useTags();

  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const filteredNotes = useMemo(() => {
    let filtered = notes;
    if (selectedNotebookId) {
      filtered = filtered.filter((n) => n.notebook_id === selectedNotebookId);
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
  }, [notes, selectedNotebookId, searchQuery, selectedTagIds, getTagsForNote]);

  const selectedNote = selectedNoteId ? notes.find((n) => n.id === selectedNoteId) : null;

  const handleCreateNote = async () => {
    try {
      const note = await createNote.mutateAsync({ notebook_id: selectedNotebookId });
      setSelectedNoteId(note.id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteNote = (id: string) => {
    deleteNote.mutate(id, {
      onSuccess: () => {
        if (selectedNoteId === id) setSelectedNoteId(null);
        toast.success('Nota eliminada');
      },
    });
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Cargando notas...</p>;
  }

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* Left panel - notebooks + notes list */}
      <div className={`w-72 border-r border-border flex flex-col shrink-0 ${selectedNote ? 'hidden md:flex' : 'flex'}`}>
        {/* Notebooks section */}
        <div className="p-3 border-b border-border">
          <NotebookList
            notebooks={notebooks}
            notes={notes}
            selectedNotebookId={selectedNotebookId}
            onSelect={(id) => {
              setSelectedNotebookId(id);
              setSelectedNoteId(null);
            }}
            onCreateNotebook={(data) => createNotebook.mutate(data, { onSuccess: () => toast.success('Libreta creada') })}
            onDeleteNotebook={(id) =>
              deleteNotebook.mutate(id, {
                onSuccess: () => {
                  if (selectedNotebookId === id) setSelectedNotebookId(null);
                  toast.success('Libreta eliminada');
                },
              })
            }
            onUpdateNotebook={(id, data) => updateNotebook.mutate({ id, ...data })}
          />
        </div>

        {/* Search + filters */}
        <div className="p-2 space-y-2 border-b border-border">
          <div className="relative">
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

        {/* Notes list */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {filteredNotes.length} nota{filteredNotes.length !== 1 ? 's' : ''}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCreateNote}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-0.5 px-2 pb-2">
            {filteredNotes.map((note) => {
              const preview = note.content.replace(/<[^>]*>/g, '').slice(0, 80);
              const noteTagIds = getTagsForNote(note.id);
              const noteTagsList = tags.filter((t) => noteTagIds.includes(t.id));
              return (
                <button
                  key={note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                    selectedNoteId === note.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                  }`}
                >
                  <p className="text-xs font-medium truncate">{note.title || 'Sin título'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{preview || 'Nota vacía'}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(note.updated_at), 'd MMM', { locale: es })}
                    </span>
                    {noteTagsList.slice(0, 2).map((t) => (
                      <span key={t.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                    ))}
                  </div>
                </button>
              );
            })}
            {filteredNotes.length === 0 && (
              <div className="text-center py-8">
                <StickyNote className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No hay notas</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel - editor */}
      <div className={`flex-1 min-w-0 ${!selectedNote ? 'hidden md:flex' : 'flex'}`}>
        {selectedNote ? (
          <NoteEditor
            key={selectedNote.id}
            note={selectedNote}
            notebooks={notebooks}
            allTags={tags}
            noteTagIds={getTagsForNote(selectedNote.id)}
            onUpdate={(id, data) => updateNote.mutate({ id, ...data })}
            onDelete={handleDeleteNote}
            onAddTag={(noteId, tagId) => addNoteTag.mutate({ note_id: noteId, tag_id: tagId })}
            onRemoveTag={(noteId, tagId) => removeNoteTag.mutate({ note_id: noteId, tag_id: tagId })}
            onBack={() => setSelectedNoteId(null)}
            onUploadImage={uploadImage}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <StickyNote className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Selecciona o crea una nota</p>
              <Button size="sm" className="mt-3 text-xs gap-1" onClick={handleCreateNote}>
                <Plus className="h-3 w-3" /> Nueva nota
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
