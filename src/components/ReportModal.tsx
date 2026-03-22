import { useState, useMemo, useEffect, useCallback } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isAfter, isBefore, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, FileDown, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatStoredDate, parseStoredDate } from '@/lib/date';
import { downloadReportPdf } from '@/lib/generateReportPdf';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import { useDepartments } from '@/hooks/useDepartments';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topics: TopicWithSubtasks[];
}

type Period = 'week' | 'month' | 'custom';

const STATUS_LABELS: Record<string, string> = {
  activo: 'Activos',
  seguimiento: 'Seguimiento',
  completado: 'Completados',
  pausado: 'Pausados',
};

const STATUS_ORDER = ['activo', 'seguimiento', 'completado', 'pausado'];

function getTrafficLight(dueDateStr: string | null | undefined): { icon: string; label: string } {
  if (!dueDateStr) return { icon: '🟢', label: 'Al día' };
  const dueDate = parseStoredDate(dueDateStr);
  if (!dueDate) return { icon: '🟢', label: 'Al día' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueCopy = new Date(dueDate);
  dueCopy.setHours(0, 0, 0, 0);
  if (isBefore(dueCopy, today)) return { icon: '🔴', label: 'Atrasado' };
  if (isBefore(dueCopy, addDays(today, 4))) return { icon: '🟡', label: 'Próximo' };
  return { icon: '🟢', label: 'Al día' };
}

function isWithinPeriod(dateStr: string, start: Date, end: Date): boolean {
  try {
    const d = parseISO(dateStr);
    return !isBefore(d, start) && !isAfter(d, end);
  } catch { return false; }
}

export function ReportModal({ open, onOpenChange, topics }: ReportModalProps) {
  const queryClient = useQueryClient();
  const { departments } = useDepartments();
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState<Date>(subDays(new Date(), 30));
  const [customEnd, setCustomEnd] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  // Config
  const [reportTitle, setReportTitle] = useState('Informe Ejecutivo');
  const [authorName, setAuthorName] = useState('');
  const [authorRole, setAuthorRole] = useState('');
  const ownerLabel = authorName || 'Yo';

  // Section toggles
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [includeBitacora, setIncludeBitacora] = useState(true);
  const [includeResponsables, setIncludeResponsables] = useState(true);

  // Selection state
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [excludedSubtaskIds, setExcludedSubtaskIds] = useState<Set<string>>(new Set());
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(new Set());

  // Group topics by status
  const topicsByStatus = useMemo(() => {
    const grouped: Record<string, TopicWithSubtasks[]> = {};
    STATUS_ORDER.forEach(s => { grouped[s] = []; });
    topics.forEach(t => {
      if (grouped[t.status]) grouped[t.status].push(t);
    });
    return grouped;
  }, [topics]);

  // Initialize all selected when modal opens
  useEffect(() => {
    if (open) {
      setSelectedTopicIds(new Set(topics.map(t => t.id)));
      setExcludedSubtaskIds(new Set());
      setExpandedTopicIds(new Set());
    }
  }, [open]);

  const { start, end } = useMemo(() => {
    const now = new Date();
    if (period === 'week') return { start: startOfWeek(now, { locale: es }), end: endOfWeek(now, { locale: es }) };
    if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now) };
    return { start: customStart, end: customEnd };
  }, [period, customStart, customEnd]);

  // Build filtered topics with filtered subtasks
  const selectedTopics = useMemo(() => {
    return topics
      .filter(t => selectedTopicIds.has(t.id))
      .map(t => ({
        ...t,
        subtasks: t.subtasks.filter(s => !excludedSubtaskIds.has(s.id)),
      }));
  }, [topics, selectedTopicIds, excludedSubtaskIds]);

  // Build subtaskFilter for PDF
  const subtaskFilter = useMemo(() => {
    const filter: Record<string, string[]> = {};
    selectedTopics.forEach(t => {
      filter[t.id] = t.subtasks.map(s => s.id);
    });
    return filter;
  }, [selectedTopics]);

  const toggleTopic = useCallback((id: string) => {
    setSelectedTopicIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSubtask = useCallback((id: string) => {
    setExcludedSubtaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedTopicIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllInStatus = useCallback((status: string) => {
    const ids = topicsByStatus[status]?.map(t => t.id) || [];
    setSelectedTopicIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
  }, [topicsByStatus]);

  const selectNoneInStatus = useCallback((status: string) => {
    const ids = new Set(topicsByStatus[status]?.map(t => t.id) || []);
    setSelectedTopicIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
  }, [topicsByStatus]);

  // Generate markdown only when saving to DB
  const generateMarkdown = useCallback(() => {
    const activeTopics = selectedTopics.filter(t => t.status === 'activo' || t.status === 'seguimiento');
    const completedTopics = selectedTopics.filter(t => t.status === 'completado');
    const pausedTopics = selectedTopics.filter(t => t.status === 'pausado');
    const totalSubs = selectedTopics.reduce((a, t) => a + t.subtasks.length, 0);
    const doneSubs = selectedTopics.reduce((a, t) => a + t.subtasks.filter(s => s.completed).length, 0);
    const pct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;
    const delayed = activeTopics.filter(t => getTrafficLight(t.due_date).icon === '🔴').length;
    const warning = activeTopics.filter(t => getTrafficLight(t.due_date).icon === '🟡').length;
    const onTrack = activeTopics.length - delayed - warning;
    const periodStr = `${format(start, 'dd MMM yyyy', { locale: es })} — ${format(end, 'dd MMM yyyy', { locale: es })}`;

    let md = `# 📊 ${reportTitle}\n\n`;
    md += `**Período:** ${periodStr}\n`;
    if (authorName) md += `**Elaborado por:** ${authorName}${authorRole ? ` — ${authorRole}` : ''}\n`;
    md += `**Emitido:** ${format(new Date(), "dd MMM yyyy 'a las' HH:mm", { locale: es })}\n\n---\n\n`;
    md += `## Resumen Ejecutivo\n\nDurante el período evaluado se gestionaron **${selectedTopics.length} temas** en total. `;
    if (completedTopics.length > 0) md += `Se completaron **${completedTopics.length} temas** exitosamente. `;
    md += `De los ${activeTopics.length} temas activos, **${onTrack}** están al día`;
    if (warning > 0) md += `, **${warning}** próximos a vencer`;
    if (delayed > 0) md += ` y **${delayed}** presentan atrasos`;
    md += `. El avance global en subtareas es de **${pct}%** (${doneSubs}/${totalSubs}).\n\n`;
    md += `### Indicadores Clave\n\n| Indicador | Valor |\n|---|---|\n`;
    md += `| Temas totales | ${selectedTopics.length} |\n| 🟢 Al día | ${onTrack} |\n| 🟡 Próximos | ${warning} |\n| 🔴 Atrasados | ${delayed} |\n`;
    if (completedTopics.length > 0) md += `| ✅ Completados | ${completedTopics.length} |\n`;
    if (pausedTopics.length > 0) md += `| ⏸️ Pausados | ${pausedTopics.length} |\n`;
    md += `| Subtareas completadas | ${doneSubs}/${totalSubs} (${pct}%) |\n\n`;

    if (includeCompleted && completedTopics.length > 0) {
      md += `## ✅ Logros del Período\n\n`;
      completedTopics.forEach(t => { md += `- **${t.title}** — Responsable: ${t.assignee || ownerLabel}\n`; });
      md += `\n`;
    }
    if (activeTopics.length > 0) {
      md += `## Semáforo General\n\n| Tema | Responsable | Prioridad | Estado | Fecha cierre | Progreso |\n|---|---|---|---|---|---|\n`;
      activeTopics.forEach(t => {
        const tl = getTrafficLight(t.due_date);
        const done = t.subtasks.filter(s => s.completed).length;
        const total = t.subtasks.length;
        const dueStr = t.due_date ? formatStoredDate(t.due_date, 'dd MMM', { locale: es }) : '—';
        md += `| ${t.title} | ${t.assignee || ownerLabel} | ${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)} | ${tl.icon} ${tl.label} | ${dueStr} | ${total > 0 ? `${done}/${total}` : '—'} |\n`;
      });
      md += `\n`;
    }
    md += `## Detalle por Tema\n\n`;
    selectedTopics.forEach(t => {
      const tl = getTrafficLight(t.due_date);
      const done = t.subtasks.filter(s => s.completed).length;
      const total = t.subtasks.length;
      md += `### ${tl.icon} ${t.title}\n\n- **Estado:** ${STATUS_LABELS[t.status] || t.status}\n- **Responsable:** ${t.assignee || ownerLabel}\n- **Prioridad:** ${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}\n`;
      if (t.due_date) md += `- **Fecha cierre:** ${formatStoredDate(t.due_date, 'dd MMM yyyy', { locale: es })}\n`;
      if (total > 0) md += `- **Progreso:** ${done}/${total} subtareas (${Math.round((done / total) * 100)}%)\n`;
      md += `\n`;
      if (t.subtasks.length > 0) {
        md += `**Subtareas:**\n`;
        t.subtasks.forEach(s => {
          const isNew = isWithinPeriod(s.created_at, start, end);
          md += `- [${s.completed ? 'x' : ' '}] ${s.title}${isNew ? ' ⭐ NUEVO' : ''}\n`;
        });
        md += `\n`;
      }
      if (includeBitacora) {
        const recentEntries = t.progress_entries.filter(e => isWithinPeriod(e.created_at, start, end));
        const olderEntries = t.progress_entries.filter(e => !isWithinPeriod(e.created_at, start, end));
        if (recentEntries.length > 0) {
          md += `**📌 Novedades (este período):**\n`;
          recentEntries.forEach(e => { md += `- ⭐ ${e.content}\n`; });
          md += `\n`;
        }
        if (olderEntries.length > 0) {
          md += `**Bitácora anterior:**\n`;
          olderEntries.forEach(e => { md += `- ${e.content}\n`; });
          md += `\n`;
        }
      }
      md += `---\n\n`;
    });
    if (includeResponsables) {
      const assigneeMap = new Map<string, TopicWithSubtasks[]>();
      selectedTopics.forEach(t => {
        const key = t.assignee || ownerLabel;
        if (!assigneeMap.has(key)) assigneeMap.set(key, []);
        assigneeMap.get(key)!.push(t);
      });
      if (assigneeMap.size > 0) {
        md += `## Resumen por Responsable\n\n| Responsable | Temas | Activos | Completados | Atrasados |\n|---|---|---|---|---|\n`;
        assigneeMap.forEach((tList, name) => {
          const active = tList.filter(t => t.status === 'activo' || t.status === 'seguimiento').length;
          const completed = tList.filter(t => t.status === 'completado').length;
          const overdue = tList.filter(t => getTrafficLight(t.due_date).icon === '🔴').length;
          md += `| ${name} | ${tList.length} | ${active} | ${completed} | ${overdue} |\n`;
        });
        md += `\n`;
      }
    }
    md += `*Generado automáticamente el ${format(new Date(), "dd MMM yyyy 'a las' HH:mm", { locale: es })}*\n`;
    return md;
  }, [selectedTopics, start, end, reportTitle, authorName, authorRole, includeCompleted, includeBitacora, includeResponsables, ownerLabel]);

  const handleDownloadPdf = () => {
    downloadReportPdf({
      topics: selectedTopics,
      periodStart: start,
      periodEnd: end,
      title: reportTitle,
      authorName: authorName || undefined,
      authorRole: authorRole || undefined,
      includeCompleted,
      includeBitacora,
      includeResponsables,
      departments,
      subtaskFilter,
    });
    toast.success('PDF descargado');
  };

  const handleEmit = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');
      const titleForSave = `${reportTitle} ${format(start, 'dd MMM', { locale: es })} - ${format(end, 'dd MMM yyyy', { locale: es })}`;
      const { error } = await supabase.from('reports').insert({
        user_id: user.id,
        title: titleForSave,
        content: generateMarkdown(),
        period_start: format(start, 'yyyy-MM-dd'),
        period_end: format(end, 'yyyy-MM-dd'),
      });
      if (error) throw error;
      downloadReportPdf({
        topics: selectedTopics,
        periodStart: start,
        periodEnd: end,
        title: reportTitle,
        authorName: authorName || undefined,
        authorRole: authorRole || undefined,
        includeCompleted,
        includeBitacora,
        includeResponsables,
        departments,
        subtaskFilter,
      });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Informe emitido y PDF descargado');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const totalSelected = selectedTopicIds.size;
  const totalTopics = topics.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col gap-3 p-5">
        <DialogHeader className="pb-0">
          <DialogTitle className="text-base">Emitir Informe</DialogTitle>
          <DialogDescription className="text-xs">
            Selecciona temas, subtareas y configura tu informe.
          </DialogDescription>
        </DialogHeader>

        {/* ===== ZONA 1: Config rápida ===== */}
        <div className="grid grid-cols-3 gap-2">
          <Input value={reportTitle} onChange={e => setReportTitle(e.target.value)} className="h-7 text-xs" placeholder="Título del informe" />
          <Input value={authorName} onChange={e => setAuthorName(e.target.value)} className="h-7 text-xs" placeholder="Tu nombre" />
          <Input value={authorRole} onChange={e => setAuthorRole(e.target.value)} className="h-7 text-xs" placeholder="Cargo / Rol" />
        </div>

        {/* Period + section toggles row */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['week', 'month', 'custom'] as Period[]).map(value => (
            <Button key={value} size="sm" variant={period === value ? 'default' : 'outline'} className="h-6 text-[11px] px-2" onClick={() => setPeriod(value)}>
              {value === 'week' ? 'Semana' : value === 'month' ? 'Mes' : 'Custom'}
            </Button>
          ))}
          {period === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-6 text-[11px] px-2">
                    <CalendarIcon className="h-3 w-3 mr-1" />{format(customStart, 'dd/MM')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStart} onSelect={d => d && setCustomStart(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-[10px] text-muted-foreground">—</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-6 text-[11px] px-2">
                    <CalendarIcon className="h-3 w-3 mr-1" />{format(customEnd, 'dd/MM')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEnd} onSelect={d => d && setCustomEnd(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </>
          )}
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-1 cursor-pointer">
              <Switch checked={includeCompleted} onCheckedChange={setIncludeCompleted} className="scale-[0.6]" />
              <span className="text-[10px] text-muted-foreground">Logros</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <Switch checked={includeBitacora} onCheckedChange={setIncludeBitacora} className="scale-[0.6]" />
              <span className="text-[10px] text-muted-foreground">Bitácora</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <Switch checked={includeResponsables} onCheckedChange={setIncludeResponsables} className="scale-[0.6]" />
              <span className="text-[10px] text-muted-foreground">Responsables</span>
            </label>
          </div>
        </div>

        {/* ===== ZONA 2: Selector de temas con subtareas ===== */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">
            {totalSelected} de {totalTopics} temas seleccionados
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => setSelectedTopicIds(new Set(topics.map(t => t.id)))}>
              Todos
            </Button>
            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => setSelectedTopicIds(new Set())}>
              Ninguno
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[40vh] rounded-md border border-border bg-muted/10">
          <div className="p-2 space-y-3">
            {STATUS_ORDER.map(status => {
              const statusTopics = topicsByStatus[status];
              if (!statusTopics || statusTopics.length === 0) return null;
              const selectedInStatus = statusTopics.filter(t => selectedTopicIds.has(t.id)).length;

              return (
                <div key={status}>
                  {/* Status header */}
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">
                      {STATUS_LABELS[status]} ({selectedInStatus}/{statusTopics.length})
                    </span>
                    <div className="flex-1 h-px bg-border" />
                    <Button variant="ghost" size="sm" className="h-4 text-[9px] px-1" onClick={() => selectAllInStatus(status)}>
                      ✓ Todos
                    </Button>
                    <Button variant="ghost" size="sm" className="h-4 text-[9px] px-1" onClick={() => selectNoneInStatus(status)}>
                      ✗
                    </Button>
                  </div>

                  {/* Topics in this status */}
                  <div className="space-y-0.5">
                    {statusTopics.map(t => {
                      const isSelected = selectedTopicIds.has(t.id);
                      const isExpanded = expandedTopicIds.has(t.id);
                      const tl = getTrafficLight(t.due_date);
                      const hasSubtasks = t.subtasks.length > 0;
                      const excludedCount = t.subtasks.filter(s => excludedSubtaskIds.has(s.id)).length;
                      const subtaskLabel = hasSubtasks
                        ? `${t.subtasks.length - excludedCount}/${t.subtasks.length}`
                        : '';

                      return (
                        <div key={t.id}>
                          <div className={cn(
                            "flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors",
                            isSelected ? "bg-muted/40" : "opacity-50"
                          )}>
                            {/* Expand button */}
                            {hasSubtasks ? (
                              <button
                                onClick={() => toggleExpand(t.id)}
                                className="p-0 h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                              >
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              </button>
                            ) : (
                              <span className="w-4 shrink-0" />
                            )}

                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleTopic(t.id)}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-xs shrink-0">{tl.icon}</span>
                            <span className="text-xs truncate flex-1 text-foreground">{t.title}</span>
                            {subtaskLabel && (
                              <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
                                sub: {subtaskLabel}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground shrink-0 max-w-[80px] truncate">
                              {t.assignee || ownerLabel}
                            </span>
                          </div>

                          {/* Subtasks */}
                          {isExpanded && hasSubtasks && (
                            <div className="ml-8 pl-2 border-l border-border/50 space-y-0.5 py-0.5">
                              {t.subtasks.map(s => {
                                const isSubExcluded = excludedSubtaskIds.has(s.id);
                                return (
                                  <label key={s.id} className={cn(
                                    "flex items-center gap-1.5 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/30",
                                    isSubExcluded && "opacity-40"
                                  )}>
                                    <Checkbox
                                      checked={!isSubExcluded}
                                      onCheckedChange={() => toggleSubtask(s.id)}
                                      className="h-3 w-3"
                                    />
                                    <span className={cn("text-[11px]", s.completed ? "line-through text-muted-foreground" : "text-foreground")}>
                                      {s.title}
                                    </span>
                                    {s.responsible && (
                                      <span className="text-[9px] text-muted-foreground ml-auto shrink-0">{s.responsible}</span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* ===== ZONA 3: Acciones ===== */}
        <div className="flex items-center gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleDownloadPdf}>
            <FileDown className="h-3 w-3 mr-1" /> PDF
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleEmit} disabled={saving || totalSelected === 0}>
            <Save className="h-3 w-3 mr-1" />
            {saving ? 'Emitiendo...' : 'Emitir Informe'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
