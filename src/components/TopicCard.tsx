import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Plus, Trash2, CalendarIcon, CheckCircle2, RotateCcw } from 'lucide-react';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProgressLog } from '@/components/ProgressLog';
import { TagSelector } from '@/components/TagSelector';
import { cn } from '@/lib/utils';
import { formatStoredDate, parseStoredDate, toStoredDate } from '@/lib/date';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import type { Tag } from '@/hooks/useTags';
import type { Database } from '@/integrations/supabase/types';

type Priority = Database['public']['Enums']['topic_priority'];
type Status = Database['public']['Enums']['topic_status'];

interface TopicCardProps {
  topic: TopicWithSubtasks;
  allTags: Tag[];
  topicTags: Tag[];
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (topicId: string, title: string) => void;
  onToggleSubtask: (id: string, completed: boolean) => void;
  onUpdateSubtask: (id: string, data: any) => void;
  onDeleteSubtask: (id: string) => void;
  onAddProgressEntry: (topicId: string, content: string) => void;
  onAddTag: (topicId: string, tagId: string) => void;
  onRemoveTag: (topicId: string, tagId: string) => void;
  onCreateTag: (name: string, color: string) => Promise<any>;
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  alta: { label: 'Alta', className: 'bg-[hsl(var(--priority-alta))] text-white border-transparent' },
  media: { label: 'Media', className: 'bg-[hsl(var(--priority-media))] text-white border-transparent' },
  baja: { label: 'Baja', className: 'bg-[hsl(var(--priority-baja))] text-white border-transparent' },
};

const statusLabels: Record<Status, string> = {
  activo: 'Activo',
  completado: 'Completado',
  pausado: 'Pausado',
};

export function TopicCard({
  topic,
  allTags,
  topicTags,
  onUpdate,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onAddProgressEntry,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: TopicCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');

  const completedCount = topic.subtasks.filter((s) => s.completed).length;
  const totalCount = topic.subtasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isCompleted = topic.status === 'completado';

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    onAddSubtask(topic.id, newSubtask.trim());
    setNewSubtask('');
  };

  return (
    <div className={cn('bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow', isCompleted && 'opacity-75')}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-4 text-left">
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('font-medium text-sm text-card-foreground truncate', isCompleted && 'line-through')}>
              {topic.title}
            </span>
            <Badge className={cn('text-[10px] px-1.5 py-0', priorityConfig[topic.priority].className)}>
              {priorityConfig[topic.priority].label}
            </Badge>
            {topic.status !== 'activo' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {statusLabels[topic.status]}
              </Badge>
            )}
            {topicTags.length > 0 && (
              <div className="flex items-center gap-1 ml-1">
                {topicTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-block rounded-full px-1.5 py-0 text-[9px] text-white font-medium"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
                {topicTags.length > 3 && (
                  <span className="text-[9px] text-muted-foreground">+{topicTags.length - 3}</span>
                )}
              </div>
            )}
          </div>
          {totalCount > 0 && (
            <div className="mt-1.5 h-[2px] w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-foreground/40 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground font-mono">
              {completedCount}/{totalCount}
            </span>
          )}
          {topic.due_date && (
            <span className="text-xs text-muted-foreground font-mono">
              {formatStoredDate(topic.due_date, 'dd MMM', { locale: es })}
            </span>
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 space-y-4 border-t border-border">
              <div className="flex items-center gap-3 pt-3 flex-wrap">
                <Select value={topic.priority} onValueChange={(value: Priority) => onUpdate(topic.id, { priority: value })}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={topic.status} onValueChange={(value: Status) => onUpdate(topic.id, { status: value })}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="completado">Completado</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {topic.due_date ? formatStoredDate(topic.due_date, 'dd MMM yyyy', { locale: es }) : 'Fecha cierre'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseStoredDate(topic.due_date)}
                      onSelect={(date) => onUpdate(topic.id, { due_date: toStoredDate(date) })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:text-destructive ml-auto"
                  onClick={() => onDelete(topic.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              <Button
                size="sm"
                variant={isCompleted ? 'outline' : 'default'}
                className="w-full h-9 text-xs gap-2"
                onClick={() => onUpdate(topic.id, { status: isCompleted ? 'activo' : 'completado' })}
              >
                {isCompleted ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" /> Reabrir Tema
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como Completado
                  </>
                )}
              </Button>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subtareas</p>
                {topic.subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 group">
                    <Checkbox
                      checked={subtask.completed}
                      onCheckedChange={(checked) => onToggleSubtask(subtask.id, !!checked)}
                    />
                    <span className={cn('text-sm flex-1', subtask.completed && 'line-through text-muted-foreground')}>
                      {subtask.title}
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          {subtask.due_date ? (
                            formatStoredDate(subtask.due_date, 'dd MMM', { locale: es })
                          ) : (
                            <CalendarIcon className="h-3 w-3" />
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={parseStoredDate(subtask.due_date)}
                          onSelect={(date) => onUpdateSubtask(subtask.id, { due_date: toStoredDate(date) })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <button
                      type="button"
                      onClick={() => onDeleteSubtask(subtask.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    placeholder="Nueva subtarea..."
                    value={newSubtask}
                    onChange={(event) => setNewSubtask(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleAddSubtask()}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={handleAddSubtask}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <TagSelector
                allTags={allTags}
                topicTags={topicTags}
                onAddTag={(tagId) => onAddTag(topic.id, tagId)}
                onRemoveTag={(tagId) => onRemoveTag(topic.id, tagId)}
                onCreateTag={async (name, color) => {
                  const newTag = await onCreateTag(name, color);
                  if (newTag) onAddTag(topic.id, newTag.id);
                }}
              />

              <ProgressLog entries={topic.progress_entries} onAdd={(content) => onAddProgressEntry(topic.id, content)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
