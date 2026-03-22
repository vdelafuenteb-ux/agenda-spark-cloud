import { useState, useEffect } from 'react';
import { isStoredDateToday, isStoredDateUpcoming, isStoredDateOverdue } from '@/lib/date';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Plus, Trash2, CalendarIcon, CheckCircle2, RotateCcw, Pause, Play, User, Pin, Check, X, Infinity as InfinityIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { NotificationSection } from '@/components/NotificationSection';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubtaskRow } from '@/components/SubtaskRow';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ProgressLog } from '@/components/ProgressLog';
import { TagSelector } from '@/components/TagSelector';
import { cn } from '@/lib/utils';
import { formatStoredDate, parseStoredDate, toStoredDate } from '@/lib/date';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import type { Tag } from '@/hooks/useTags';
import type { Assignee } from '@/hooks/useAssignees';
import type { Department } from '@/hooks/useDepartments';
import type { Database } from '@/integrations/supabase/types';

type Priority = Database['public']['Enums']['topic_priority'];
type Status = Database['public']['Enums']['topic_status'];

interface TopicCardProps {
  topic: TopicWithSubtasks;
  allTags: Tag[];
  topicTags: Tag[];
  assignees: Assignee[];
  departments: Department[];
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
  onAddSubtaskEntry: (subtaskId: string, content: string) => void;
  onUpdateSubtaskEntry?: (id: string, content: string) => void;
  onDeleteSubtaskEntry?: (id: string) => void;
  onAddProgressEntry: (topicId: string, content: string) => void;
  onUpdateProgressEntry?: (id: string, content: string) => void;
  onDeleteProgressEntry?: (id: string) => void;
  onAddTag: (topicId: string, tagId: string) => void;
  onRemoveTag: (topicId: string, tagId: string) => void;
  onCreateTag: (name: string, color: string) => Promise<any>;
}

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
  departments,
  onCreateAssignee,
  highlightToday = false,
  highlightUpcoming = false,
  highlightOverdue = false,
  forceExpand = null,
  onUpdate,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onAddSubtaskEntry,
  onUpdateSubtaskEntry,
  onDeleteSubtaskEntry,
  onAddProgressEntry,
  onUpdateProgressEntry,
  onDeleteProgressEntry,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: TopicCardProps) {
  const [expanded, setExpanded] = useState(() => {
    if (forceExpand !== null) return forceExpand;
    return false;
  });
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [newAssigneeName, setNewAssigneeName] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(topic.title);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseReasonDraft, setPauseReasonDraft] = useState('');

  useEffect(() => {
    if (forceExpand !== null) {
      setExpanded(forceExpand);
    } else if (highlightToday || highlightUpcoming) {
      setExpanded(true);
    }
  }, [forceExpand, highlightToday, highlightUpcoming]);

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
      'bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow border-l-4',
      isCompleted && 'opacity-75',
      isSeguimiento ? 'border-l-[hsl(var(--seguimiento))] bg-[hsl(var(--seguimiento-bg))]'
        : topic.priority === 'alta' ? 'border-l-destructive'
        : topic.pinned ? 'border-l-primary'
        : 'border-l-transparent'
    )}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-3 text-left">
        {/* Pin + Chevron */}
        <div className="flex items-center gap-1 shrink-0">
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

        {/* Main content — two lines */}
        <div className="flex-1 min-w-0 space-y-0.5">
          {/* Line 1: Title + progress + date */}
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
                <button type="button" onClick={(e) => { e.stopPropagation(); if (titleDraft.trim() && titleDraft.trim() !== topic.title) onUpdate(topic.id, { title: titleDraft.trim() }); setEditingTitle(false); }} className="p-0.5 text-emerald-500 hover:text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); setTitleDraft(topic.title); setEditingTitle(false); }} className="p-0.5 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <span
                className={cn('font-medium text-sm text-card-foreground truncate cursor-pointer hover:underline', isCompleted && 'line-through')}
                onDoubleClick={(e) => { e.stopPropagation(); setTitleDraft(topic.title); setEditingTitle(true); }}
                title="Doble clic para editar"
              >
                {topic.title}
              </span>
            )}

            {/* Right-aligned compact info */}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {totalCount > 0 && (
                <span className="text-[11px] text-muted-foreground font-mono">{completedCount}/{totalCount}</span>
              )}
              {isCompleted && topic.updated_at && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  Cerrado {formatStoredDate(topic.updated_at.split('T')[0], 'dd MMM yy', { locale: es })}
                </span>
              )}
              {topic.due_date && !isCompleted && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  {formatStoredDate(topic.due_date, 'dd MMM', { locale: es })}
                </span>
              )}
              {!isCompleted && !topic.is_ongoing && !topic.due_date && (
                <span className="text-[10px] text-destructive font-medium">Sin fecha</span>
              )}
            </div>
          </div>

          {/* Line 2: Metadata — subtle, dot-separated */}
          {(() => {
            const metaParts: React.ReactNode[] = [];

            // Alerts
            if (showSubtaskOverdueBadge) {
              metaParts.push(
                <span key="overdue" className="text-destructive font-medium">
                  {subtaskOverdueCount} atrasada{subtaskOverdueCount === 1 ? '' : 's'}
                </span>
              );
            }
            if (showSubtaskTodayBadge) {
              metaParts.push(
                <span key="today" className="text-accent-foreground font-medium">
                  {subtaskTodayCount} hoy
                </span>
              );
            }
            if (showSubtaskUpcomingBadge) {
              metaParts.push(
                <span key="upcoming" className="text-yellow-600 dark:text-yellow-400">
                  {subtaskUpcomingCount} próxima{subtaskUpcomingCount === 1 ? '' : 's'}
                </span>
              );
            }

            // Assignee
            if (topic.assignee) {
              metaParts.push(<span key="assignee">{topic.assignee}</span>);
            }

            // Department
            const dept = departments.find(d => d.id === topic.department_id);
            if (dept) {
              metaParts.push(<span key="dept">{dept.name}</span>);
            }

            // Ongoing
            if (topic.is_ongoing && !isCompleted) {
              metaParts.push(
                <span key="ongoing" className="inline-flex items-center gap-0.5">
                  <InfinityIcon className="h-2.5 w-2.5" /> Continuo
                </span>
              );
            }

            const hasMetaOrTags = metaParts.length > 0 || topicTags.length > 0 || (topic.status !== 'activo');

            if (!hasMetaOrTags && totalCount === 0) return null;

            return (
              <div className="flex items-center gap-1 flex-wrap">
                {metaParts.map((part, i) => (
                  <span key={i} className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {i > 0 && <span className="text-muted-foreground/40">·</span>}
                    {part}
                  </span>
                ))}

                {/* Tag dots */}
                {topicTags.length > 0 && (
                  <TooltipProvider delayDuration={300}>
                    <div className="flex items-center gap-0.5 ml-1">
                      {topicTags.slice(0, 5).map((tag) => (
                        <Tooltip key={tag.id}>
                          <TooltipTrigger asChild>
                            <span
                              className="w-2 h-2 rounded-full inline-block shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {tag.name}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {topicTags.length > 5 && (
                        <span className="text-[9px] text-muted-foreground">+{topicTags.length - 5}</span>
                      )}
                    </div>
                  </TooltipProvider>
                )}

                {/* Status badge — only when not 'activo' */}
                {topic.status !== 'activo' && (
                  <Badge variant="outline" className={cn(
                    "text-[9px] px-1.5 py-0 ml-1",
                    isSeguimiento && "bg-[hsl(var(--seguimiento))] text-[hsl(var(--seguimiento-foreground))] border-transparent",
                    topic.status === 'pausado' && "bg-muted text-muted-foreground border-transparent"
                  )}>
                    {statusLabels[topic.status]}
                  </Badge>
                )}

                {/* Progress bar inline */}
                {totalCount > 0 && (
                  <div className="ml-auto h-[2px] w-16 bg-muted rounded-full overflow-hidden shrink-0">
                    <div className="h-full bg-foreground/40 transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
            );
          })()}
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

                {!isCompleted && (
                  <label className="inline-flex items-center gap-1.5 cursor-pointer h-8 px-2 rounded-md border border-input text-xs hover:bg-accent transition-colors">
                    <Switch
                      checked={(topic as any).is_ongoing || false}
                      onCheckedChange={(checked) => onUpdate(topic.id, { is_ongoing: checked, ...(checked ? { due_date: null } : {}) })}
                      className="scale-75"
                    />
                    <InfinityIcon className="h-3 w-3" />
                    <span className="hidden sm:inline">Continuo</span>
                  </label>
                )}

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

              {/* Assignee field */}
              {!isCompleted && (
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

              {/* Department selector */}
              {departments.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Departamento</label>
                  <Select
                    value={(topic as any).department_id || 'none'}
                    onValueChange={(value) => onUpdate(topic.id, { department_id: value === 'none' ? null : value } as any)}
                  >
                    <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Sin departamento" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin departamento</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status actions */}
              <div className="flex items-center gap-2">
              {(topic.status === 'activo' || topic.status === 'seguimiento') && (
                  <>
                    {topic.status === 'activo' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-9 text-xs gap-2"
                        onClick={() => {
                          if (!topic.assignee) {
                            // If no assignee, just switch status - user can assign after
                          }
                          onUpdate(topic.id, { status: 'seguimiento' });
                        }}
                      >
                        <User className="h-3.5 w-3.5" /> Seguimiento
                      </Button>
                    )}
                    {topic.status === 'seguimiento' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-9 text-xs gap-2"
                        onClick={() => onUpdate(topic.id, { status: 'activo', assignee: null })}
                      >
                        <Play className="h-3.5 w-3.5" /> Activo
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-9 text-xs gap-2"
                      onClick={() => {
                        setPauseReasonDraft('');
                        setShowPauseDialog(true);
                      }}
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
                    {/* Show pause reason and date */}
                    {((topic as any).pause_reason || (topic as any).paused_at) && (
                      <div className="w-full bg-muted/50 rounded-md p-3 mb-2 border border-border">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Motivo de pausa</p>
                        <p className="text-sm text-foreground">{(topic as any).pause_reason || 'Sin motivo registrado'}</p>
                        {(topic as any).paused_at && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Pausado el {formatStoredDate((topic as any).paused_at.split('T')[0], 'dd MMM yyyy', { locale: es })}
                          </p>
                        )}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-9 text-xs gap-2"
                      onClick={() => onUpdate(topic.id, { status: 'activo', pause_reason: '', paused_at: null })}
                    >
                      <Play className="h-3.5 w-3.5" /> Reactivar
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 h-9 text-xs gap-2"
                      onClick={() => onUpdate(topic.id, { status: 'completado', pause_reason: '', paused_at: null })}
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
                    onAddSubtaskEntry={onAddSubtaskEntry}
                    onUpdateSubtaskEntry={onUpdateSubtaskEntry}
                    onDeleteSubtaskEntry={onDeleteSubtaskEntry}
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

              <ProgressLog
                entries={topic.progress_entries}
                onAdd={(content) => onAddProgressEntry(topic.id, content)}
                onUpdate={onUpdateProgressEntry ? (id, content) => onUpdateProgressEntry(id, content) : undefined}
                onDelete={onDeleteProgressEntry}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause reason dialog */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Por qué pausas este tema?</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Motivo de la pausa (obligatorio)..."
            value={pauseReasonDraft}
            onChange={(e) => setPauseReasonDraft(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPauseDialog(false)}>Cancelar</Button>
            <Button
              disabled={!pauseReasonDraft.trim()}
              onClick={() => {
                onUpdate(topic.id, {
                  status: 'pausado',
                  pause_reason: pauseReasonDraft.trim(),
                  paused_at: new Date().toISOString(),
                });
                setShowPauseDialog(false);
              }}
            >
              <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
