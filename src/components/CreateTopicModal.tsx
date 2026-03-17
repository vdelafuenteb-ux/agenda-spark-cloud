import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Plus, X, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import type { Tag as TagType } from '@/hooks/useTags';
import type { Database } from '@/integrations/supabase/types';

type Priority = Database['public']['Enums']['topic_priority'];
type Status = Database['public']['Enums']['topic_status'];

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#6b7280',
];

interface CreateTopicModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allTags: TagType[];
  onSubmit: (data: {
    title: string;
    priority: Priority;
    status: Status;
    due_date: string | null;
    subtasks: string[];
    tagIds: string[];
    newTags: { name: string; color: string }[];
    notes: string;
  }) => void;
  isPending: boolean;
}

export function CreateTopicModal({ open, onOpenChange, allTags, onSubmit, isPending }: CreateTopicModalProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('media');
  const [status, setStatus] = useState<Status>('activo');
  const [dueDate, setDueDate] = useState<Date | undefined>();
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
    setDueDate(undefined);
    setSubtasks([]);
    setNewSubtask('');
    setSelectedTagIds([]);
    setPendingNewTags([]);
    setNewTagName('');
    setNotes('');
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks(prev => [...prev, newSubtask.trim()]);
    setNewSubtask('');
  };

  const handleCreateNewTag = () => {
    if (!newTagName.trim()) return;
    setPendingNewTags(prev => [...prev, { name: newTagName.trim(), color: newTagColor }]);
    setNewTagName('');
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      priority,
      status,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      subtasks,
      tagIds: selectedTagIds,
      newTags: pendingNewTags,
      notes,
    });
    reset();
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Tema</DialogTitle>
          <DialogDescription>Configura todos los detalles del tema antes de crearlo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Título</label>
            <Input
              placeholder="Nombre del tema..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="h-9 text-sm"
              autoFocus
            />
          </div>

          {/* Priority + Status + Date row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prioridad</label>
              <Select value={priority} onValueChange={(v: Priority) => setPriority(v)}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</label>
              <Select value={status} onValueChange={(v: Status) => setStatus(v)}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                </SelectContent>
              </Select>
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
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Etiquetas</label>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map(tag => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
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
              {pendingNewTags.map((tag, i) => (
                <Badge
                  key={`new-${i}`}
                  className="text-[10px] px-2 py-0.5 gap-1 border-transparent text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                  <button onClick={() => setPendingNewTags(prev => prev.filter((_, j) => j !== i))}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            {/* Create new tag inline */}
            <div className="flex items-center gap-2 mt-1">
              <Input
                placeholder="Nueva etiqueta..."
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateNewTag()}
                className="h-7 text-xs flex-1"
              />
              <div className="flex gap-0.5">
                {TAG_COLORS.slice(0, 5).map(c => (
                  <button
                    key={c}
                    onClick={() => setNewTagColor(c)}
                    className="h-4 w-4 rounded-full transition-transform"
                    style={{
                      backgroundColor: c,
                      transform: newTagColor === c ? 'scale(1.3)' : 'scale(1)',
                      boxShadow: newTagColor === c ? `0 0 0 1.5px hsl(var(--background)), 0 0 0 2.5px ${c}` : 'none',
                    }}
                  />
                ))}
              </div>
              <Button size="sm" variant="ghost" className="h-7 shrink-0 text-xs" onClick={handleCreateNewTag} disabled={!newTagName.trim()}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Subtasks */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subtareas</label>
            {subtasks.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground text-xs">•</span>
                <span className="flex-1">{s}</span>
                <button onClick={() => setSubtasks(prev => prev.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Agregar subtarea..."
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={handleAddSubtask}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Initial notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nota inicial (opcional)</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Contexto, observaciones iniciales..."
              className="text-sm min-h-[60px] resize-none"
            />
          </div>

          {/* Submit */}
          <Button className="w-full" onClick={handleSubmit} disabled={!title.trim() || isPending}>
            {isPending ? 'Creando...' : 'Crear Tema'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
