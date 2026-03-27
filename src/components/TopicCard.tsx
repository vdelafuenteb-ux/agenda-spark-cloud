import { useState, useEffect } from 'react';
import { isStoredDateToday, isStoredDateUpcoming, isStoredDateOverdue } from '@/lib/date';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Plus, Trash2, CalendarIcon, CheckCircle2, RotateCcw, Pause, Play, User, Pin, Check, X, Infinity as InfinityIcon, RefreshCw } from 'lucide-react';
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
import type { Reschedule } from '@/hooks/useReschedules';
import { computeTopicOvertime, formatDuration } from '@/lib/rescheduleMetrics';

type Priority = Database['public']['Enums']['topic_priority'];


interface TopicCardProps {
  topic: TopicWithSubtasks;
  allTags: Tag[];
  topicTags: Tag[];
  assignees: Assignee[];
  departments: Department[];
  reschedules: Reschedule[];
  onCreateReschedule: { mutateAsync: (params: { user_id: string; topic_id: string; previous_date: string | null; new_date: string | null; reason: string; is_external: boolean }) => Promise<void> };
  userId: string;
  onCreateAssignee: (name: string) => Promise<Assignee>;
  highlightToday?: boolean;
  highlightUpcoming?: boolean;
  highlightOverdue?: boolean;
  forceExpand?: boolean | null;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (topicId: string, title: string) => void;
  onToggleSubtask: (id: string, completed: boolean) => void;
  onUpdateSubtask: (id: string, data: Record<string, unknown>) => void;
  onDeleteSubtask: (id: string) => void;
  onAddSubtaskEntry: (subtaskId: string, content: string) => Promise<string>;
  onUpdateSubtaskEntry?: (id: string, content: string) => void;
  onDeleteSubtaskEntry?: (id: string) => void;
  onAddSubtaskContact?: (subtaskId: string, name: string, email: string) => void;
  onUpdateSubtaskContact?: (id: string, name?: string, email?: string) => void;
  onDeleteSubtaskContact?: (id: string) => void;
  onAddProgressEntry: (topicId: string, content: string) => Promise<string>;
  onUpdateProgressEntry?: (id: string, content: string) => void;
  onDeleteProgressEntry?: (id: string) => void;
  onUploadFiles?: (entryId: string, entryType: 'progress' | 'subtask', files: File[]) => void;
  onDeleteAttachment?: (id: string, fileUrl: string) => void;
  onAddTag: (topicId: string, tagId: string) => void;
  onRemoveTag: (topicId: string, tagId: string) => void;
  onCreateTag: (name: string, color: string) => Promise<any>;
}


export function TopicCard({
  topic,
  allTags,
  topicTags,
  assignees,
  departments,
  reschedules,
  onCreateReschedule,
  userId,
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
  onAddSubtaskContact,
  onUpdateSubtaskContact,
  onDeleteSubtaskContact,
  onAddProgressEntry,
  onUpdateProgressEntry,
  onDeleteProgressEntry,
  onUploadFiles,
  onDeleteAttachment,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: TopicCardProps) {
  const [expanded, setExpanded] = useState(() => {
    if (forceExpand !== null) return forceExpand;
    return false;
  });
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const [completedSubtasksExpanded, setCompletedSubtasksExpanded] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [newAssigneeName, setNewAssigneeName] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(topic.title);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseReasonDraft, setPauseReasonDraft] = useState(topic.pause_reason || '');
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeDateDraft, setCloseDateDraft] = useState('');
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleNewDate, setRescheduleNewDate] = useState<Date | undefined>(undefined);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleIsExternal, setRescheduleIsExternal] = useState(false);
  const [showRescheduleHistory, setShowRescheduleHistory] = useState(false);

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

  const handleDateChange = (newDate: Date | undefined) => {
    const newStored = toStoredDate(newDate);
    // If topic already has a due_date and it's changing, show reschedule dialog
    if (topic.due_date && newStored && newStored !== topic.due_date) {
      setRescheduleNewDate(newDate);
      setRescheduleReason('');
      setRescheduleIsExternal(false);
      setShowRescheduleDialog(true);
    } else {
      // First time setting or clearing — no reschedule needed
      onUpdate(topic.id, { due_date: newStored });
    }
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleNewDate) return;
    const newStored = toStoredDate(rescheduleNewDate);
    try {
      await onCreateReschedule.mutateAsync({
        user_id: userId,
        topic_id: topic.id,
        previous_date: topic.due_date,
        new_date: newStored,
        reason: rescheduleReason.trim(),
        is_external: rescheduleIsExternal,
      });
    } catch { /* ignore */ }
    onUpdate(topic.id, { due_date: newStored });
    setShowRescheduleDialog(false);
  };

  return (
    <div data-topic-id={topic.id} className={cn(
      'bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow border-l-4',
      isCompleted
        ? 'border-l-emerald-500'
        : topic.status === 'pausado'
          ? 'border-l-yellow-500'
          : isSeguimiento
            ? 'border-l-[hsl(var(--seguimiento))]'
            : 'border-l-foreground'
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
            {(topic as any).execution_order != null && (
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0" title={`Orden #${(topic as any).execution_order}`}>
                {(topic as any).execution_order}
              </span>
            )}
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
              {isCompleted && (topic as any).closed_at && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  Cerrado {formatStoredDate((topic as any).closed_at.split('T')[0], 'dd MMM yy', { locale: es })}
                </span>
              )}
              {isCompleted && topic.due_date && (topic as any).closed_at && (() => {
                const closedDate = new Date((topic as any).closed_at);
                const dueDate = new Date(topic.due_date + 'T23:59:59');
                const diffDays = Math.round((closedDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays <= 0) return <Badge variant="outline" className="text-[9px] border-emerald-500/50 text-emerald-600 px-1.5 py-0">A tiempo</Badge>;
                return <Badge variant="destructive" className="text-[9px] px-1.5 py-0">{diffDays}d atraso</Badge>;
              })()}
              {!isCompleted && (() => {
                const isOverdue = isStoredDateOverdue(topic.due_date);
                const overdueDays = isOverdue && topic.due_date
                  ? Math.ceil((Date.now() - parseStoredDate(topic.due_date)!.getTime()) / 86400000)
                  : 0;
                return (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "flex items-center gap-1 hover:bg-accent rounded px-1 py-0.5 transition-colors",
                        !topic.due_date && !topic.is_ongoing && "text-destructive",
                        isOverdue && "text-destructive",
                      )}
                    >
                      <CalendarIcon className={cn("h-3 w-3", isOverdue && "text-destructive")} />
                      {topic.due_date ? (
                        <span className={cn("text-[11px] font-mono", isOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                          {formatStoredDate(topic.due_date, 'dd MMM', { locale: es })}
                        </span>
                      ) : !topic.is_ongoing ? (
                        <span className="text-[10px] font-medium">Sin fecha</span>
                      ) : null}
                      {isOverdue && overdueDays > 0 && (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0">{overdueDays}d</Badge>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end" onClick={(e) => e.stopPropagation()}>
                    <Calendar
                      mode="single"
                      selected={parseStoredDate(topic.due_date)}
                      onSelect={(d) => handleDateChange(d)}
                    />
                    {topic.due_date && (
                      <div className="p-2 border-t">
                        <Button variant="ghost" size="sm" className="w-full text-xs text-destructive" onClick={() => onUpdate(topic.id, { due_date: null })}>
                          Quitar fecha
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )}
              {/* Reschedule badge */}
              {reschedules.length > 0 && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        <RefreshCw className="h-2.5 w-2.5" />{reschedules.length}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {reschedules.length} reprogramación{reschedules.length !== 1 ? 'es' : ''}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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

            // HH badge
            if ((topic as any).hh_value && (topic as any).hh_type) {
              const hhLabel = (topic as any).hh_type === 'diaria' ? '/día' : (topic as any).hh_type === 'semanal' ? '/sem' : 'total';
              metaParts.push(
                <span key="hh" className="inline-flex items-center gap-0.5 text-primary font-medium">
                  {(topic as any).hh_value}h {hhLabel}
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

                {/* Priority badge — only alta */}
                {topic.priority === 'alta' && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-1 bg-destructive/15 text-destructive border-destructive/30">
                    Alta
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
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-muted-foreground font-medium uppercase">Orden</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="—"
                  value={(topic as any).execution_order ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value) : null;
                    onUpdate(topic.id, { execution_order: val });
                  }}
                  className="w-14 h-8 text-xs text-center"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

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
                      onSelect={(date) => handleDateChange(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {!isCompleted && (
                  <label className="inline-flex items-center gap-1.5 cursor-pointer h-8 px-2 rounded-md border border-input text-xs hover:bg-accent transition-colors">
                    <Switch
                      checked={topic.is_ongoing || false}
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

              {/* Horas Hombre */}
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-[10px] text-muted-foreground font-medium uppercase">HH</label>
                <Select
                  value={(topic as any).hh_type || 'none'}
                  onValueChange={(v) => onUpdate(topic.id, { hh_type: v === 'none' ? null : v, ...(!v || v === 'none' ? { hh_value: null } : {}) })}
                >
                  <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin HH</SelectItem>
                    <SelectItem value="diaria">Diaria</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="total">Total</SelectItem>
                  </SelectContent>
                </Select>
                {(topic as any).hh_type && (
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="Hrs"
                    value={(topic as any).hh_value ?? ''}
                    onChange={(e) => onUpdate(topic.id, { hh_value: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-16 h-8 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                {(topic as any).hh_type && (topic as any).hh_value && (
                  <span className="text-[10px] text-muted-foreground">
                    {(topic as any).hh_type === 'diaria' ? `≈ ${((topic as any).hh_value * 5).toFixed(1)}h/sem` : (topic as any).hh_type === 'semanal' ? `${(topic as any).hh_value}h/sem` : `${(topic as any).hh_value}h total`}
                  </span>
                )}
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

              {/* Department selector */}
              {departments.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Departamento</label>
                  <Select
                    value={topic.department_id || 'none'}
                    onValueChange={(value) => onUpdate(topic.id, { department_id: value === 'none' ? null : value })}
                  >
                    <SelectTrigger className="w-full sm:w-48 h-8 text-xs"><SelectValue placeholder="Sin departamento" /></SelectTrigger>
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
              <div className="flex items-center gap-2 flex-wrap">
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
                      onClick={() => {
                        const now = new Date();
                        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                        setCloseDateDraft(now.toISOString().slice(0, 16));
                        setShowCloseDialog(true);
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Cerrar
                    </Button>
                  </>
                )}
                {topic.status === 'pausado' && (
                  <>
                    {/* Editable pause reason */}
                    <div className="w-full bg-muted/50 rounded-md p-3 mb-2 border border-border space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Motivo de pausa</p>
                      <Textarea
                        placeholder="Escribe el motivo de la pausa..."
                        value={pauseReasonDraft || topic.pause_reason || ''}
                        onChange={(e) => setPauseReasonDraft(e.target.value)}
                        onBlur={() => {
                          const newReason = (pauseReasonDraft ?? '').trim();
                          const oldReason = topic.pause_reason || '';
                          if (newReason !== oldReason) {
                            onUpdate(topic.id, {
                              pause_reason: newReason,
                              ...(!topic.paused_at ? { paused_at: new Date().toISOString() } : {}),
                            });
                          }
                        }}
                        className="min-h-[60px] text-sm"
                      />
                      {topic.paused_at && (
                        <p className="text-[10px] text-muted-foreground">
                          Pausado el {formatStoredDate(topic.paused_at.split('T')[0], 'dd MMM yyyy', { locale: es })}
                        </p>
                      )}
                    </div>
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
                      onClick={() => {
                        const now = new Date();
                        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                        setCloseDateDraft(now.toISOString().slice(0, 16));
                        setShowCloseDialog(true);
                      }}
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
                    onClick={() => onUpdate(topic.id, { status: 'activo', closed_at: null })}
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
                {(() => {
                  const pending = topic.subtasks.filter(s => !s.completed);
                  const completed = topic.subtasks.filter(s => s.completed);
                  return (
                    <>
                      {pending.map((subtask) => {
                        const subtaskIsToday = highlightToday && isStoredDateToday(subtask.due_date);
                        const subtaskIsUpcoming = highlightUpcoming && isStoredDateUpcoming(subtask.due_date, 3);
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
                            onAddSubtaskContact={onAddSubtaskContact}
                            onUpdateSubtaskContact={onUpdateSubtaskContact}
                            onDeleteSubtaskContact={onDeleteSubtaskContact}
                            onUploadFiles={onUploadFiles}
                            onDeleteAttachment={onDeleteAttachment}
                          />
                        );
                      })}
                      {completed.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setCompletedSubtasksExpanded(!completedSubtasksExpanded)}
                            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors mt-2 py-1"
                          >
                            {completedSubtasksExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            Terminadas ({completed.length})
                          </button>
                          {completedSubtasksExpanded && (
                            <div className="space-y-1 mt-1">
                              {completed.map((subtask) => (
                                <SubtaskRow
                                  key={subtask.id}
                                  subtask={subtask}
                                  subtaskIsToday={false}
                                  subtaskIsUpcoming={false}
                                  onToggleSubtask={onToggleSubtask}
                                  onUpdateSubtask={onUpdateSubtask}
                                  onDeleteSubtask={onDeleteSubtask}
                                  onAddSubtaskEntry={onAddSubtaskEntry}
                                  onUpdateSubtaskEntry={onUpdateSubtaskEntry}
                                  onDeleteSubtaskEntry={onDeleteSubtaskEntry}
                                  onAddSubtaskContact={onAddSubtaskContact}
                                  onUpdateSubtaskContact={onUpdateSubtaskContact}
                                  onDeleteSubtaskContact={onDeleteSubtaskContact}
                                  onUploadFiles={onUploadFiles}
                                  onDeleteAttachment={onDeleteAttachment}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </>
                  );
                })()}
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

              {/* Reschedule History */}
              {reschedules.length > 0 && (() => {
                const impact = computeTopicOvertime(topic, reschedules);
                return (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setShowRescheduleHistory(!showRescheduleHistory)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                  >
                    {showRescheduleHistory ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <RefreshCw className="h-3 w-3" />
                    Reprogramaciones ({reschedules.length})
                  </button>
                  {/* Overtime summary */}
                  {impact && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-amber-500/5 rounded px-2 py-1.5 border border-amber-500/20">
                      <span>Planificado: <strong className="text-foreground">{formatDuration(impact.originalDuration)}</strong></span>
                      <span>→</span>
                      <span>Real: <strong className="text-foreground">{formatDuration(impact.actualDuration)}</strong></span>
                      {impact.overtimePct > 0 && (
                        <Badge variant="outline" className={cn("text-[9px] ml-auto", impact.overtimePct > 50 ? "border-destructive/50 text-destructive" : "border-amber-500/50 text-amber-600")}>
                          +{impact.overtimePct}% sobretiempo
                        </Badge>
                      )}
                    </div>
                  )}
                  {showRescheduleHistory && (
                    <div className="space-y-1.5 pl-4 border-l-2 border-amber-500/30">
                      {reschedules.map((r) => (
                        <div key={r.id} className="text-xs space-y-0.5 py-1.5 border-b border-border last:border-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground font-mono">
                              {r.previous_date ? formatStoredDate(r.previous_date, 'dd MMM', { locale: es }) : 'Sin fecha'}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-mono font-medium text-foreground">
                              {r.new_date ? formatStoredDate(r.new_date, 'dd MMM', { locale: es }) : 'Sin fecha'}
                            </span>
                            {r.is_external && (
                              <Badge variant="outline" className="text-[8px] px-1.5 py-0 border-blue-500/50 text-blue-600">Externa</Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {formatStoredDate(r.created_at.split('T')[0], 'dd MMM yy', { locale: es })}
                            </span>
                          </div>
                          {r.reason && <p className="text-muted-foreground italic">{r.reason}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                );
              })()}

              <ProgressLog
                entries={topic.progress_entries}
                onAdd={async (content) => {
                  const id = await onAddProgressEntry(topic.id, content);
                  return id;
                }}
                onUpdate={onUpdateProgressEntry ? (id, content) => onUpdateProgressEntry(id, content) : undefined}
                onDelete={onDeleteProgressEntry}
                onUploadFiles={onUploadFiles ? (entryId, files) => onUploadFiles(entryId, 'progress', files) : undefined}
                onDeleteAttachment={onDeleteAttachment}
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

      {/* Close confirmation dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Confirmar cierre de este tema?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Confirma la fecha y hora en que se cerró realmente este tema.
          </p>
          <Input
            type="datetime-local"
            value={closeDateDraft}
            onChange={(e) => setCloseDateDraft(e.target.value)}
            className="w-full"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const closedAt = closeDateDraft
                  ? new Date(closeDateDraft).toISOString()
                  : new Date().toISOString();
                onUpdate(topic.id, {
                  status: 'completado',
                  closed_at: closedAt,
                  pause_reason: '',
                  paused_at: null,
                });
                setShowCloseDialog(false);
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirmar cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule reason dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo de reprogramación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Estás cambiando la fecha de <strong>{topic.due_date ? formatStoredDate(topic.due_date, 'dd MMM yyyy', { locale: es }) : '—'}</strong> a <strong>{rescheduleNewDate ? formatStoredDate(toStoredDate(rescheduleNewDate) || '', 'dd MMM yyyy', { locale: es }) : '—'}</strong>.
          </p>
          <Textarea
            placeholder="¿Por qué se reprograma? (opcional)"
            value={rescheduleReason}
            onChange={(e) => setRescheduleReason(e.target.value)}
            className="min-h-[60px]"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={rescheduleIsExternal}
              onCheckedChange={setRescheduleIsExternal}
              className="scale-90"
            />
            <span className="text-sm text-muted-foreground">Causa externa (fuera de nuestro control)</span>
          </label>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowRescheduleDialog(false)}>Cancelar</Button>
            <Button onClick={handleConfirmReschedule}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Confirmar cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
