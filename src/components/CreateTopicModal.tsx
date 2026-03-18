import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { toStoredDate } from '@/lib/date';
import type { Tag as TagType } from '@/hooks/useTags';
import type { Database } from '@/integrations/supabase/types';

type Priority = Database['public']['Enums']['topic_priority'];
type Status = Database['public']['Enums']['topic_status'];

const TAG_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6b7280'];

interface CreateTopicModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allTags: TagType[];
  onSubmit: (data: {
    title: string;
    priority: Priority;
    status: Status;
    start_date: string | null;
    due_date: string | null;
    subtasks: string[];
    tagIds: string[];
    newTags: { name: string; color: string }[];
    notes: string;
  }) => Promise<void> | void;
  isPending: boolean;
}

export function CreateTopicModal({ open, onOpenChange, allTags, onSubmit, isPending }: CreateTopicModalProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('media');
  const [status, setStatus] = useState<Status>('activo');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState<Date>();
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [pendingNewTags, setPendingNewTags] = useState<{ name: string; color: string }[]>([]);
  const [notes, setNotes] = useState('');

  const reset = () => {
    setTitle('');
    setPriority('media');
    setStatus('activo');
    setAssignee('');
    setDueDate(undefined);
    setStartDate(new Date());
    setSubtasks([]);
    setNewSubtask('');
    setSelectedTagIds([]);
    setPendingNewTags([]);
    setNewTagName('');
    setNewTagColor(TAG_COLORS[0]);
    setNotes('');
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks((prev) => [...prev, newSubtask.trim()]);
    setNewSubtask('');
  };

  const handleCreateNewTag = () => {
    if (!newTagName.trim()) return;
    setPendingNewTags((prev) => [...prev, { name: newTagName.trim(), color: newTagColor }]);
    setNewTagName('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (status === 'seguimiento' && !assignee.trim()) return;
    await onSubmit({
      title: title.trim(),
      priority,
      status,
      start_date: toStoredDate(startDate),
      due_date: toStoredDate(dueDate),
      subtasks,
      tagIds: selectedTagIds,
      newTags: pendingNewTags,
      notes,
      assignee: status === 'seguimiento' ? assignee.trim() : undefined,
    });
    reset();
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) reset(); onOpenChange(value); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Tema</DialogTitle>
          <DialogDescription>Configura todos los detalles del tema antes de crearlo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Título</label>
            <Input placeholder="Nombre del tema..." value={title} onChange={(event) => setTitle(event.target.value)} className="h-9 text-sm" autoFocus />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prioridad</label>
              <Select value={priority} onValueChange={(value: Priority) => setPriority(value)}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</label>
              <Select value={status} onValueChange={(value: Status) => setStatus(value)}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha inicio</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {startDate ? format(startDate, 'dd MMM yyyy', { locale: es }) : 'Hoy'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha cierre</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {dueDate ? format(dueDate, 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Etiquetas</label>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all"
                    style={{
                      backgroundColor: isSelected ? tag.color : 'transparent',
                      color: isSelected ? '#fff' : tag.color,
                      border: `1.5px solid ${tag.color}`,
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
              {pendingNewTags.map((tag, index) => (
                <Badge key={`new-${index}`} className="text-[10px] px-2 py-0.5 gap-1 border-transparent text-white" style={{ backgroundColor: tag.color }}>
                  {tag.name}
                  <button type="button" onClick={() => setPendingNewTags((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Input placeholder="Nueva etiqueta..." value={newTagName} onChange={(event) => setNewTagName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleCreateNewTag()} className="h-7 text-xs flex-1" />
              <div className="flex gap-0.5">
                {TAG_COLORS.slice(0, 5).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    className="h-4 w-4 rounded-full transition-transform"
                    style={{
                      backgroundColor: color,
                      transform: newTagColor === color ? 'scale(1.3)' : 'scale(1)',
                      boxShadow: newTagColor === color ? `0 0 0 1.5px hsl(var(--background)), 0 0 0 2.5px ${color}` : 'none',
                    }}
                  />
                ))}
              </div>
              <Button size="sm" variant="ghost" className="h-7 shrink-0 text-xs" onClick={handleCreateNewTag} disabled={!newTagName.trim()}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subtareas</label>
            {subtasks.map((subtask, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground text-xs">•</span>
                <span className="flex-1">{subtask}</span>
                <button type="button" onClick={() => setSubtasks((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}>
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input placeholder="Agregar subtarea..." value={newSubtask} onChange={(event) => setNewSubtask(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleAddSubtask()} className="h-8 text-sm" />
              <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={handleAddSubtask}><Plus className="h-3 w-3" /></Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nota inicial (opcional)</label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contexto, observaciones iniciales..." className="text-sm min-h-[60px] resize-none" />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={!title.trim() || isPending}>
            {isPending ? 'Creando...' : 'Crear Tema'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
