import { useState, useEffect } from 'react';
import { isStoredDateToday, isStoredDateUpcoming, isStoredDateOverdue } from '@/lib/date';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Plus, Trash2, CalendarIcon, CheckCircle2, RotateCcw, Pause, Play, User, Pin, Check, X } from 'lucide-react';
import { NotificationSection } from '@/components/NotificationSection';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubtaskRow } from '@/components/SubtaskRow';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProgressLog } from '@/components/ProgressLog';
import { TagSelector } from '@/components/TagSelector';
import { cn } from '@/lib/utils';
import { formatStoredDate, parseStoredDate, toStoredDate } from '@/lib/date';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import type { Tag } from '@/hooks/useTags';
import type { Assignee } from '@/hooks/useAssignees';
import type { Database } from '@/integrations/supabase/types';

type Priority = Database['public']['Enums']['topic_priority'];
type Status = Database['public']['Enums']['topic_status'];

interface TopicCardProps {
  topic: TopicWithSubtasks;
  allTags: Tag[];
  topicTags: Tag[];
  assignees: Assignee[];
  onCreateAssignee: (name: string) => Promise<Assignee>;
  highlightToday?: boolean;
  highlightUpcoming?: boolean;
  highlightOverdue?: boolean;
  forceExpand?: boolean | null;
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
  completado: 'Cerrado',
  pausado: 'Pausado',
  seguimiento: 'Seguimiento',
};

export function TopicCard({
  topic,
  allTags,
  topicTags,
  assignees,
  onCreateAssignee,
  highlightToday = false,
  highlightUpcoming = false,
  highlightOverdue = false,
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
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [newAssigneeName, setNewAssigneeName] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(topic.title);

  useEffect(() => {
    if (highlightToday || highlightUpcoming) setExpanded(true);
  }, [highlightToday, highlightUpcoming]);

  const subtaskTodayCount = topic.subtasks.filter(s => isStoredDateToday(s.due_date)).length;
  const showSubtaskTodayBadge = highlightToday && subtaskTodayCount > 0;

  const subtaskUpcomingCount = topic.subtasks.filter(s => !s.completed && isStoredDateUpcoming(s.due_date, 3)).length;
  const showSubtaskUpcomingBadge = highlightUpcoming && subtaskUpcomingCount > 0;

  const subtaskOverdueCount = topic.subtasks.filter(s => !s.completed && isStoredDateOverdue(s.due_date)).length;
  const showSubtaskOverdueBadge = highlightOverdue && subtaskOverdueCount > 0;

  const completedCount = topic.subtasks.filter((s) => s.completed).length;
  const totalCount = topic.subtasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isCompleted = topic.status === 'completado';
  const isSeguimiento = topic.status === 'seguimiento';

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    onAddSubtask(topic.id, newSubtask.trim());
    setNewSubtask('');
  };

  return (
    <div className={cn(
      'bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow',
      isCompleted && 'opacity-75',
      isSeguimiento && 'border-l-4 border-l-[hsl(var(--seguimiento))] bg-[hsl(var(--seguimiento-bg))]',
      topic.pinned && !isSeguimiento && 'border-l-4 border-l-primary'
    )}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-4 text-left">
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onUpdate(topic.id, { pinned: !topic.pinned }); }}
            className={cn(
              'p-0.5 rounded hover:bg-accent transition-colors',
              topic.pinned ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'
            )}
            title={topic.pinned ? 'Desfijar' : 'Fijar arriba'}
          >
            <Pin className={cn('h-3.5 w-3.5', topic.pinned && 'fill-current')} />
          </button>
          <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {editingTitle ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (titleDraft.trim() && titleDraft.trim() !== topic.title) {
                        onUpdate(topic.id, { title: titleDraft.trim() });
                      }
                      setEditingTitle(false);
                    }
                    if (e.key === 'Escape') {
                      setTitleDraft(topic.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="font-medium text-sm text-card-foreground bg-transparent border-b border-primary outline-none min-w-[120px]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (titleDraft.trim() && titleDraft.trim() !== topic.title) {
                      onUpdate(topic.id, { title: titleDraft.trim() });
                    }
                    setEditingTitle(false);
                  }}
                  className="p-0.5 text-emerald-500 hover:text-emerald-600"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTitleDraft(topic.title);
                    setEditingTitle(false);
                  }}
                  className="p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <span
                className={cn('font-medium text-sm text-card-foreground truncate cursor-pointer hover:underline', isCompleted && 'line-through')}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setTitleDraft(topic.title);
                  setEditingTitle(true);
                }}
                title="Doble clic para editar"
              >
                {topic.title}
              </span>
            )}
            <Badge className={cn('text-[10px] px-1.5 py-0', priorityConfig[topic.priority].className)}>
              {priorityConfig[topic.priority].label}
            </Badge>
            {showSubtaskTodayBadge && (
              <Badge className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground border-transparent">
                📌 {subtaskTodayCount} subtarea{subtaskTodayCount === 1 ? '' : 's'} hoy
              </Badge>
            )}
            {showSubtaskOverdueBadge && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                🔴 {subtaskOverdueCount} subtarea{subtaskOverdueCount === 1 ? '' : 's'} atrasada{subtaskOverdueCount === 1 ? '' : 's'}
              </Badge>
            )}
            {showSubtaskUpcomingBadge && (
              <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/20 text-yellow-700 border-transparent">
                📅 {subtaskUpcomingCount} subtarea{subtaskUpcomingCount === 1 ? '' : 's'} próxima{subtaskUpcomingCount === 1 ? '' : 's'}
              </Badge>
            )}
            {topic.status !== 'activo' && (
              <Badge variant="outline" className={cn(
                "text-[10px] px-1.5 py-0",
                isSeguimiento && "bg-[hsl(var(--seguimiento))] text-[hsl(var(--seguimiento-foreground))] border-transparent"
              )}>
                {statusLabels[topic.status]}
              </Badge>
            )}
            {topic.assignee && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                <User className="h-2.5 w-2.5" />
                {topic.assignee}
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

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      <span className="text-muted-foreground">Inicio:</span>
                      {topic.start_date ? formatStoredDate(topic.start_date, 'dd MMM', { locale: es }) : '—'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseStoredDate(topic.start_date)}
                      onSelect={(date) => onUpdate(topic.id, { start_date: toStoredDate(date) })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      <span className="text-muted-foreground">Fin:</span>
                      {topic.due_date ? formatStoredDate(topic.due_date, 'dd MMM', { locale: es }) : '—'}
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

              {/* Assignee field for seguimiento */}
              {isSeguimiento && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Responsable</label>
                  {assignees.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {assignees.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onUpdate(topic.id, { assignee: a.name })}
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-all',
                            topic.assignee === a.name
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-transparent text-foreground border-border hover:border-primary/50'
                          )}
                        >
                          <User className="h-2.5 w-2.5 mr-1" />
                          {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Nuevo responsable..."
                      value={newAssigneeName}
                      onChange={(e) => setNewAssigneeName(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && newAssigneeName.trim()) {
                          e.preventDefault();
                          const created = await onCreateAssignee(newAssigneeName.trim());
                          onUpdate(topic.id, { assignee: created.name });
                          setNewAssigneeName('');
                        }
                      }}
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 shrink-0"
                      disabled={!newAssigneeName.trim()}
                      onClick={async () => {
                        if (!newAssigneeName.trim()) return;
                        const created = await onCreateAssignee(newAssigneeName.trim());
                        onUpdate(topic.id, { assignee: created.name });
                        setNewAssigneeName('');
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Status actions */}
              <div className="flex items-center gap-2">
                {(topic.status === 'activo' || topic.status === 'seguimiento') && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-9 text-xs gap-2"
                      onClick={() => onUpdate(topic.id, { status: 'pausado' })}
                    >
                      <Pause className="h-3.5 w-3.5" /> Pausar
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 h-9 text-xs gap-2"
                      onClick={() => onUpdate(topic.id, { status: 'completado' })}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Cerrar
                    </Button>
                  </>
                )}
                {topic.status === 'pausado' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-9 text-xs gap-2"
                      onClick={() => onUpdate(topic.id, { status: 'activo' })}
                    >
                      <Play className="h-3.5 w-3.5" /> Reactivar
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 h-9 text-xs gap-2"
                      onClick={() => onUpdate(topic.id, { status: 'completado' })}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Cerrar
                    </Button>
                  </>
                )}
                {topic.status === 'completado' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-9 text-xs gap-2"
                    onClick={() => onUpdate(topic.id, { status: 'activo' })}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setSubtasksExpanded(!subtasksExpanded)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  {subtasksExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Subtareas ({completedCount}/{totalCount})
                </button>
                <AnimatePresence>
                  {subtasksExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden space-y-1.5"
                    >
                {topic.subtasks.map((subtask) => {
                  const subtaskIsToday = highlightToday && isStoredDateToday(subtask.due_date);
                  const subtaskIsUpcoming = highlightUpcoming && !subtask.completed && isStoredDateUpcoming(subtask.due_date, 3);
                  return (
                  <SubtaskRow
                    key={subtask.id}
                    subtask={subtask}
                    subtaskIsToday={subtaskIsToday}
                    subtaskIsUpcoming={subtaskIsUpcoming}
                    onToggleSubtask={onToggleSubtask}
                    onUpdateSubtask={onUpdateSubtask}
                    onDeleteSubtask={onDeleteSubtask}
                  />
                  );
                })}
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {isSeguimiento && (
                <NotificationSection topic={topic} assignees={assignees} />
              )}

              <ProgressLog entries={topic.progress_entries} onAdd={(content) => onAddProgressEntry(topic.id, content)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
