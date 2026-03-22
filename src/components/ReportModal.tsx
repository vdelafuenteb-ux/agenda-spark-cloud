import { useState, useMemo, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isAfter, isBefore, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Copy, FileDown, Save, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatStoredDate, parseStoredDate } from '@/lib/date';
import { downloadReportPdf } from '@/lib/generateReportPdf';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import { useDepartments } from '@/hooks/useDepartments';

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

function getTrafficLight(dueDateStr: string | null | undefined): { icon: string; label: string } {
  if (!dueDateStr) return { icon: '🟢', label: 'Al día' };
  const dueDate = parseStoredDate(dueDateStr);
  if (!dueDate) return { icon: '🟢', label: 'Al día' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueCopy = new Date(dueDate);
  dueCopy.setHours(0, 0, 0, 0);
  if (isBefore(dueCopy, today)) return { icon: '🔴', label: 'Atrasado' };
  if (isBefore(dueCopy, addDays(today, 4))) return { icon: '🟡', label: 'Próximo a vencer' };
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
  const [topicSelectorOpen, setTopicSelectorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Personalización
  const [reportTitle, setReportTitle] = useState('Informe Ejecutivo');
  const ownerLabel = authorName || 'Yo';
  const [authorName, setAuthorName] = useState('');
  const [authorRole, setAuthorRole] = useState('');

  // Filtros de estado
  const [includeStatuses, setIncludeStatuses] = useState<string[]>(['activo', 'seguimiento', 'completado', 'pausado']);
  
  // Filtro de responsable
  const [filterAssignee, setFilterAssignee] = useState<string>('todos');

  // Toggles de secciones
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [includeBitacora, setIncludeBitacora] = useState(true);
  const [includeResponsables, setIncludeResponsables] = useState(true);

  // Temas disponibles según filtros
  const availableTopics = useMemo(() => {
    let filtered = topics.filter(t => includeStatuses.includes(t.status));
    if (filterAssignee !== 'todos') {
      if (filterAssignee === 'yo') {
        filtered = filtered.filter(t => !t.assignee);
      } else {
        filtered = filtered.filter(t => t.assignee === filterAssignee);
      }
    }
    return filtered;
  }, [topics, includeStatuses, filterAssignee]);

  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);

  // Responsables únicos
  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    topics.forEach(t => { if (t.assignee) set.add(t.assignee); });
    return Array.from(set).sort();
  }, [topics]);

  // Initialize selected topics when modal opens
  useEffect(() => {
    if (open) {
      setSelectedTopicIds(availableTopics.map(t => t.id));
    }
  }, [open]);

  // Update selection when filters change
  useEffect(() => {
    setSelectedTopicIds(prev => {
      const availableIds = new Set(availableTopics.map(t => t.id));
      const kept = prev.filter(id => availableIds.has(id));
      const newIds = availableTopics.filter(t => !prev.includes(t.id)).map(t => t.id);
      return [...kept, ...newIds];
    });
  }, [availableTopics]);

  const { start, end } = useMemo(() => {
    const now = new Date();
    if (period === 'week') return { start: startOfWeek(now, { locale: es }), end: endOfWeek(now, { locale: es }) };
    if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now) };
    return { start: customStart, end: customEnd };
  }, [period, customStart, customEnd]);

  const selectedTopics = useMemo(
    () => availableTopics.filter(t => selectedTopicIds.includes(t.id)),
    [availableTopics, selectedTopicIds]
  );

  const report = useMemo(() => {
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
    md += `**Emitido:** ${format(new Date(), "dd MMM yyyy 'a las' HH:mm", { locale: es })}\n\n`;
    md += `---\n\n`;

    // Resumen Ejecutivo narrativo
    md += `## Resumen Ejecutivo\n\n`;
    md += `Durante el período evaluado se gestionaron **${selectedTopics.length} temas** en total. `;
    if (completedTopics.length > 0) md += `Se completaron **${completedTopics.length} temas** exitosamente. `;
    md += `De los ${activeTopics.length} temas activos, **${onTrack}** están al día`;
    if (warning > 0) md += `, **${warning}** próximos a vencer`;
    if (delayed > 0) md += ` y **${delayed}** presentan atrasos`;
    md += `. `;
    md += `El avance global en subtareas es de **${pct}%** (${doneSubs}/${totalSubs}).\n\n`;

    // KPIs
    md += `### Indicadores Clave\n\n`;
    md += `| Indicador | Valor |\n|---|---|\n`;
    md += `| Temas totales | ${selectedTopics.length} |\n`;
    md += `| 🟢 Al día | ${onTrack} |\n`;
    md += `| 🟡 Próximos a vencer | ${warning} |\n`;
    md += `| 🔴 Atrasados | ${delayed} |\n`;
    if (completedTopics.length > 0) md += `| ✅ Completados | ${completedTopics.length} |\n`;
    if (pausedTopics.length > 0) md += `| ⏸️ Pausados | ${pausedTopics.length} |\n`;
    md += `| Subtareas completadas | ${doneSubs}/${totalSubs} (${pct}%) |\n\n`;

    // Logros del período (completados)
    if (includeCompleted && completedTopics.length > 0) {
      md += `## ✅ Logros del Período\n\n`;
      completedTopics.forEach(t => {
        const responsable = t.assignee || ownerLabel;
        md += `- **${t.title}** — Responsable: ${responsable}\n`;
      });
      md += `\n`;
    }

    // Semáforo General (activos)
    if (activeTopics.length > 0) {
      md += `## Semáforo General\n\n`;
      md += `| Tema | Responsable | Prioridad | Estado | Fecha cierre | Progreso |\n`;
      md += `|---|---|---|---|---|---|\n`;
      activeTopics.forEach(t => {
        const tl = getTrafficLight(t.due_date);
        const done = t.subtasks.filter(s => s.completed).length;
        const total = t.subtasks.length;
        const dueStr = t.due_date ? formatStoredDate(t.due_date, 'dd MMM', { locale: es }) : '—';
        const responsable = t.assignee || ownerLabel;
        md += `| ${t.title} | ${responsable} | ${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)} | ${tl.icon} ${tl.label} | ${dueStr} | ${total > 0 ? `${done}/${total}` : '—'} |\n`;
      });
      md += `\n`;
    }

    // Detalle por Tema
    md += `## Detalle por Tema\n\n`;
    selectedTopics.forEach(t => {
      const tl = getTrafficLight(t.due_date);
      const done = t.subtasks.filter(s => s.completed).length;
      const total = t.subtasks.length;
      const responsable = t.assignee || ownerLabel;
      const statusLabel = STATUS_LABELS[t.status] || t.status;

      md += `### ${tl.icon} ${t.title}\n\n`;
      md += `- **Estado:** ${statusLabel}\n`;
      md += `- **Responsable:** ${responsable}\n`;
      md += `- **Prioridad:** ${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}\n`;
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

    // Resumen por Responsable
    if (includeResponsables) {
      const assigneeMap = new Map<string, TopicWithSubtasks[]>();
      selectedTopics.forEach(t => {
        const key = t.assignee || ownerLabel;
        if (!assigneeMap.has(key)) assigneeMap.set(key, []);
        assigneeMap.get(key)!.push(t);
      });

      if (assigneeMap.size > 0) {
        md += `## Resumen por Responsable\n\n`;
        md += `| Responsable | Temas | Activos | Completados | Atrasados |\n`;
        md += `|---|---|---|---|---|\n`;
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
  }, [selectedTopics, start, end, reportTitle, authorName, authorRole, includeCompleted, includeBitacora, includeResponsables]);

  const handleCopy = () => {
    navigator.clipboard.writeText(report);
    toast.success('Informe copiado al portapapeles');
  };

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
        content: report,
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

  const toggleTopic = (id: string) => {
    setSelectedTopicIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleStatus = (status: string) => {
    setIncludeStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Emitir Informe Ejecutivo</DialogTitle>
          <DialogDescription>Personaliza y genera un informe profesional en PDF.</DialogDescription>
        </DialogHeader>

        {/* Personalización */}
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs w-full justify-between">
              <span className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Personalización del informe</span>
              {settingsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Título del informe</Label>
                  <Input value={reportTitle} onChange={e => setReportTitle(e.target.value)} className="h-8 text-xs" placeholder="Informe Ejecutivo" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Tu nombre</Label>
                  <Input value={authorName} onChange={e => setAuthorName(e.target.value)} className="h-8 text-xs" placeholder="Ej: Juan Pérez" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Cargo / Rol</Label>
                  <Input value={authorRole} onChange={e => setAuthorRole(e.target.value)} className="h-8 text-xs" placeholder="Ej: Gerente General Interino" />
                </div>
              </div>

              {/* Filtros de estado */}
              <div className="space-y-1.5">
                <Label className="text-[11px]">Estados a incluir</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={includeStatuses.includes(key)} onCheckedChange={() => toggleStatus(key)} />
                      <span className="text-xs">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Filtro responsable */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Filtrar por responsable</Label>
                  <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="yo">Yo (sin asignar)</SelectItem>
                      {uniqueAssignees.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Secciones */}
              <div className="space-y-1.5">
                <Label className="text-[11px]">Secciones del informe</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Switch checked={includeCompleted} onCheckedChange={setIncludeCompleted} className="scale-75" />
                    <span className="text-xs">Logros (completados)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Switch checked={includeBitacora} onCheckedChange={setIncludeBitacora} className="scale-75" />
                    <span className="text-xs">Bitácoras</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Switch checked={includeResponsables} onCheckedChange={setIncludeResponsables} className="scale-75" />
                    <span className="text-xs">Resumen por responsable</span>
                  </label>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['week', 'month', 'custom'] as Period[]).map(value => (
            <Button key={value} size="sm" variant={period === value ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setPeriod(value)}>
              {value === 'week' ? 'Esta semana' : value === 'month' ? 'Este mes' : 'Personalizado'}
            </Button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <CalendarIcon className="h-3 w-3 mr-1" />{format(customStart, 'dd/MM')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStart} onSelect={d => d && setCustomStart(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">a</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <CalendarIcon className="h-3 w-3 mr-1" />{format(customEnd, 'dd/MM')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEnd} onSelect={d => d && setCustomEnd(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {/* Topic selector */}
        <Collapsible open={topicSelectorOpen} onOpenChange={setTopicSelectorOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs w-full justify-between">
              <span>Temas incluidos ({selectedTopicIds.length} de {availableTopics.length})</span>
              {topicSelectorOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1 max-h-40 overflow-auto">
              <div className="flex gap-2 mb-2">
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setSelectedTopicIds(availableTopics.map(t => t.id))}>
                  Todos
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setSelectedTopicIds([])}>
                  Ninguno
                </Button>
              </div>
              {availableTopics.map(t => {
                const tl = getTrafficLight(t.due_date);
                const responsable = t.assignee || ownerLabel;
                const statusLabel = STATUS_LABELS[t.status] || t.status;
                return (
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedTopicIds.includes(t.id)}
                      onCheckedChange={() => toggleTopic(t.id)}
                    />
                    <span className="text-xs">{tl.icon}</span>
                    <span className="text-xs text-foreground truncate flex-1">{t.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{responsable}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">({statusLabel})</span>
                  </label>
                );
              })}
              {availableTopics.length === 0 && (
                <p className="text-xs text-muted-foreground">No hay temas con los filtros seleccionados.</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Preview */}
        <div className="flex-1 overflow-auto rounded-md border border-border bg-muted/30 p-4 min-h-[200px]">
          <pre className="text-xs whitespace-pre-wrap font-mono text-foreground leading-relaxed">{report}</pre>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="h-3 w-3 mr-1" /> Copiar</Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}><FileDown className="h-3 w-3 mr-1" /> PDF</Button>
          <Button size="sm" onClick={handleEmit} disabled={saving || selectedTopicIds.length === 0}>
            <Save className="h-3 w-3 mr-1" />
            {saving ? 'Emitiendo...' : 'Emitir Informe'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
