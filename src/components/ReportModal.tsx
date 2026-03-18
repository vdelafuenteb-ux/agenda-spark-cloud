import { useState, useMemo, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isAfter, isBefore, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, Copy, FileDown, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatStoredDate, parseStoredDate } from '@/lib/date';
import { downloadReportPdf } from '@/lib/generateReportPdf';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import type { TopicWithSubtasks } from '@/hooks/useTopics';

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topics: TopicWithSubtasks[];
}

type Period = 'week' | 'month' | 'custom';

function getTrafficLight(dueDateStr: string | null | undefined): { icon: string; label: string } {
  if (!dueDateStr) return { icon: '🟢', label: 'Al día' };
  const dueDate = parseStoredDate(dueDateStr);
  if (!dueDate) return { icon: '🟢', label: 'Al día' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  if (isBefore(dueDate, today)) return { icon: '🔴', label: 'Atrasado' };
  if (isBefore(dueDate, addDays(today, 4))) return { icon: '🟡', label: 'Próximo a vencer' };
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
  const [period, setPeriod] = useState<Period>('week');
  const [customStart, setCustomStart] = useState<Date>(subDays(new Date(), 7));
  const [customEnd, setCustomEnd] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);
  const [topicSelectorOpen, setTopicSelectorOpen] = useState(false);

  const allActiveTopics = useMemo(() => topics.filter(t => t.status === 'activo'), [topics]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);

  // Initialize selected topics when modal opens or active topics change
  useEffect(() => {
    if (open) {
      setSelectedTopicIds(allActiveTopics.map(t => t.id));
    }
  }, [open, allActiveTopics]);

  const { start, end } = useMemo(() => {
    const now = new Date();
    if (period === 'week') return { start: startOfWeek(now, { locale: es }), end: endOfWeek(now, { locale: es }) };
    if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now) };
    return { start: customStart, end: customEnd };
  }, [period, customStart, customEnd]);

  const selectedTopics = useMemo(
    () => allActiveTopics.filter(t => selectedTopicIds.includes(t.id)),
    [allActiveTopics, selectedTopicIds]
  );

  const report = useMemo(() => {
    const totalSubs = selectedTopics.reduce((a, t) => a + t.subtasks.length, 0);
    const doneSubs = selectedTopics.reduce((a, t) => a + t.subtasks.filter(s => s.completed).length, 0);
    const pct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;

    const delayed = selectedTopics.filter(t => getTrafficLight(t.due_date).icon === '🔴').length;
    const warning = selectedTopics.filter(t => getTrafficLight(t.due_date).icon === '🟡').length;
    const onTrack = selectedTopics.length - delayed - warning;

    const periodStr = `${format(start, 'dd MMM yyyy', { locale: es })} — ${format(end, 'dd MMM yyyy', { locale: es })}`;

    let md = `# 📊 Informe Ejecutivo\n\n`;
    md += `**Período:** ${periodStr}\n`;
    md += `**Emitido:** ${format(new Date(), "dd MMM yyyy 'a las' HH:mm", { locale: es })}\n\n`;
    md += `---\n\n`;
    md += `## Resumen de KPIs\n\n`;
    md += `| Indicador | Valor |\n|---|---|\n`;
    md += `| Temas activos | ${selectedTopics.length} |\n`;
    md += `| 🟢 Al día | ${onTrack} |\n`;
    md += `| 🟡 Próximos a vencer | ${warning} |\n`;
    md += `| 🔴 Atrasados | ${delayed} |\n`;
    md += `| Subtareas completadas | ${doneSubs}/${totalSubs} (${pct}%) |\n\n`;

    md += `## Semáforo General\n\n`;
    md += `| Tema | Prioridad | Semáforo | Fecha cierre | Progreso |\n`;
    md += `|---|---|---|---|---|\n`;
    selectedTopics.forEach(t => {
      const tl = getTrafficLight(t.due_date);
      const done = t.subtasks.filter(s => s.completed).length;
      const total = t.subtasks.length;
      const dueStr = t.due_date ? formatStoredDate(t.due_date, 'dd MMM', { locale: es }) : '—';
      md += `| ${t.title} | ${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)} | ${tl.icon} ${tl.label} | ${dueStr} | ${total > 0 ? `${done}/${total}` : '—'} |\n`;
    });
    md += `\n`;

    md += `## Detalle por Tema\n\n`;
    selectedTopics.forEach(t => {
      const tl = getTrafficLight(t.due_date);
      const done = t.subtasks.filter(s => s.completed).length;
      const total = t.subtasks.length;

      md += `### ${tl.icon} ${t.title}\n\n`;
      md += `- **Prioridad:** ${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}\n`;
      md += `- **Estado:** ${tl.label}\n`;
      if (t.due_date) md += `- **Fecha cierre:** ${formatStoredDate(t.due_date, 'dd MMM yyyy', { locale: es })}\n`;
      if (total > 0) md += `- **Progreso:** ${done}/${total} subtareas completadas (${Math.round((done / total) * 100)}%)\n`;
      md += `\n`;

      if (t.subtasks.length > 0) {
        md += `**Subtareas:**\n`;
        t.subtasks.forEach(s => {
          const isNew = isWithinPeriod(s.created_at, start, end);
          md += `- [${s.completed ? 'x' : ' '}] ${s.title}${isNew ? ' ⭐ NUEVO' : ''}\n`;
        });
        md += `\n`;
      }

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

      md += `---\n\n`;
    });

    md += `*Generado automáticamente el ${format(new Date(), "dd MMM yyyy 'a las' HH:mm", { locale: es })}*\n`;
    return md;
  }, [selectedTopics, start, end]);

  const handleCopy = () => {
    navigator.clipboard.writeText(report);
    toast.success('Informe copiado al portapapeles');
  };

  const handleDownloadPdf = () => {
    downloadReportPdf({ topics: selectedTopics, periodStart: start, periodEnd: end });
    toast.success('PDF descargado');
  };

  const handleEmit = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');
      const { error } = await supabase.from('reports').insert({
        user_id: user.id,
        title: `Informe Ejecutivo ${format(start, 'dd MMM', { locale: es })} - ${format(end, 'dd MMM yyyy', { locale: es })}`,
        content: report,
        period_start: format(start, 'yyyy-MM-dd'),
        period_end: format(end, 'yyyy-MM-dd'),
      });
      if (error) throw error;
      // Also download the PDF
      downloadReportPdf({ topics: selectedTopics, periodStart: start, periodEnd: end });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Emitir Informe Ejecutivo</DialogTitle>
          <DialogDescription>Selecciona el período y los temas a incluir. Se genera un PDF profesional.</DialogDescription>
        </DialogHeader>

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
              <span>Temas incluidos ({selectedTopicIds.length} de {allActiveTopics.length})</span>
              {topicSelectorOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1 max-h-40 overflow-auto">
              <div className="flex gap-2 mb-2">
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setSelectedTopicIds(allActiveTopics.map(t => t.id))}>
                  Todos
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setSelectedTopicIds([])}>
                  Ninguno
                </Button>
              </div>
              {allActiveTopics.map(t => {
                const tl = getTrafficLight(t.due_date);
                return (
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedTopicIds.includes(t.id)}
                      onCheckedChange={() => toggleTopic(t.id)}
                    />
                    <span className="text-xs">{tl.icon}</span>
                    <span className="text-xs text-foreground truncate">{t.title}</span>
                  </label>
                );
              })}
              {allActiveTopics.length === 0 && (
                <p className="text-xs text-muted-foreground">No hay temas activos.</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Preview */}
        <div className="flex-1 overflow-auto rounded-md border border-border bg-muted/30 p-4">
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
