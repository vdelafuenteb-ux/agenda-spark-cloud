import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Plus, Trash2, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import type { Database } from '@/integrations/supabase/types';

type Priority = Database['public']['Enums']['topic_priority'];
type Status = Database['public']['Enums']['topic_status'];

interface TopicCardProps {
  topic: TopicWithSubtasks;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (topicId: string, title: string) => void;
  onToggleSubtask: (id: string, completed: boolean) => void;
  onDeleteSubtask: (id: string) => void;
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

export function TopicCard({ topic, onUpdate, onDelete, onAddSubtask, onToggleSubtask, onDeleteSubtask }: TopicCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [notes, setNotes] = useState(topic.progress_notes || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const completedCount = topic.subtasks.filter(s => s.completed).length;
  const totalCount = topic.subtasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  useEffect(() => {
    setNotes(topic.progress_notes || '');
  }, [topic.progress_notes]);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate(topic.id, { progress_notes: value });
    }, 800);
  }, [topic.id, onUpdate]);

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    onAddSubtask(topic.id, newSubtask.trim());
    setNewSubtask('');
  };

  return (
    <div className="bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow">
      {/* Compact row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-card-foreground truncate">{topic.title}</span>
            <Badge className={cn('text-[10px] px-1.5 py-0', priorityConfig[topic.priority].className)}>
              {priorityConfig[topic.priority].label}
            </Badge>
            {topic.status !== 'activo' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {statusLabels[topic.status]}
              </Badge>
            )}
          </div>
          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="mt-1.5 h-[2px] w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground/40 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
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
              {format(new Date(topic.due_date), 'dd MMM', { locale: es })}
            </span>
          )}
        </div>
      </button>

      {/* Expanded detail */}
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
              {/* Controls row */}
              <div className="flex items-center gap-3 pt-3 flex-wrap">
                <Select
                  value={topic.priority}
                  onValueChange={(v: Priority) => onUpdate(topic.id, { priority: v })}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={topic.status}
                  onValueChange={(v: Status) => onUpdate(topic.id, { status: v })}
                >
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
                      {topic.due_date
                        ? format(new Date(topic.due_date), 'dd MMM yyyy', { locale: es })
                        : 'Fecha cierre'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={topic.due_date ? new Date(topic.due_date) : undefined}
                      onSelect={(d) => onUpdate(topic.id, { due_date: d ? format(d, 'yyyy-MM-dd') : null })}
                      className="p-3 pointer-events-auto"
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

              {/* Subtasks checklist */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subtareas</p>
                {topic.subtasks.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 group">
                    <Checkbox
                      checked={sub.completed}
                      onCheckedChange={(checked) => onToggleSubtask(sub.id, !!checked)}
                    />
                    <span className={cn(
                      'text-sm flex-1',
                      sub.completed && 'line-through text-muted-foreground'
                    )}>
                      {sub.title}
                    </span>
                    <button
                      onClick={() => onDeleteSubtask(sub.id)}
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
                    onChange={e => setNewSubtask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={handleAddSubtask}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Progress notes */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notas de avance</p>
                <Textarea
                  value={notes}
                  onChange={e => handleNotesChange(e.target.value)}
                  placeholder="Registra avances, decisiones, observaciones..."
                  className="text-sm min-h-[80px] resize-none"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
