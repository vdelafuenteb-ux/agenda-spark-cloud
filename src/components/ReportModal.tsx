import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isAfter, isBefore, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Copy, Printer, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatStoredDate, parseStoredDate } from '@/lib/date';
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

  const { start, end } = useMemo(() => {
    const now = new Date();
    if (period === 'week') return { start: startOfWeek(now, { locale: es }), end: endOfWeek(now, { locale: es }) };
    if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now) };
    return { start: customStart, end: customEnd };
  }, [period, customStart, customEnd]);

  const activeTopics = useMemo(() => topics.filter(t => t.status === 'activo'), [topics]);

  const report = useMemo(() => {
    const totalSubs = activeTopics.reduce((a, t) => a + t.subtasks.length, 0);
    const doneSubs = activeTopics.reduce((a, t) => a + t.subtasks.filter(s => s.completed).length, 0);
    const pct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;

    const delayed = activeTopics.filter(t => getTrafficLight(t.due_date).icon === '🔴').length;
    const warning = activeTopics.filter(t => getTrafficLight(t.due_date).icon === '🟡').length;
    const onTrack = activeTopics.length - delayed - warning;

    const periodStr = `${format(start, 'dd MMM yyyy', { locale: es })} — ${format(end, 'dd MMM yyyy', { locale: es })}`;

    let md = `# 📊 Informe Ejecutivo\n\n`;
    md += `**Período:** ${periodStr}\n`;
    md += `**Emitido:** ${format(new Date(), "dd MMM yyyy 'a las' HH:mm", { locale: es })}\n\n`;
    md += `---\n\n`;
    md += `## Resumen de KPIs\n\n`;
    md += `| Indicador | Valor |\n|---|---|\n`;
    md += `| Temas activos | ${activeTopics.length} |\n`;
    md += `| 🟢 Al día | ${onTrack} |\n`;
    md += `| 🟡 Próximos a vencer | ${warning} |\n`;
    md += `| 🔴 Atrasados | ${delayed} |\n`;
    md += `| Subtareas completadas | ${doneSubs}/${totalSubs} (${pct}%) |\n\n`;

    md += `## Semáforo General\n\n`;
    md += `| Tema | Prioridad | Semáforo | Fecha cierre | Progreso |\n`;
    md += `|---|---|---|---|---|\n`;
    activeTopics.forEach(t => {
      const tl = getTrafficLight(t.due_date);
      const done = t.subtasks.filter(s => s.completed).length;
      const total = t.subtasks.length;
      const dueStr = t.due_date ? formatStoredDate(t.due_date, 'dd MMM', { locale: es }) : '—';
      md += `| ${t.title} | ${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)} | ${tl.icon} ${tl.label} | ${dueStr} | ${total > 0 ? `${done}/${total}` : '—'} |\n`;
    });
    md += `\n`;

    md += `## Detalle por Tema\n\n`;
    activeTopics.forEach(t => {
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
        recentEntries.forEach(e => {
          md += `- ⭐ ${e.content}\n`;
        });
        md += `\n`;
      }

      if (olderEntries.length > 0) {
        md += `**Bitácora anterior:**\n`;
        olderEntries.forEach(e => {
          md += `- ${e.content}\n`;
        });
        md += `\n`;
      }

      md += `---\n\n`;
    });

    md += `*Generado automáticamente el ${format(new Date(), "dd MMM yyyy 'a las' HH:mm", { locale: es })}*\n`;
    return md;
  }, [activeTopics, start, end]);

  const handleCopy = () => {
    navigator.clipboard.writeText(report);
    toast.success('Informe copiado al portapapeles');
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Informe Ejecutivo</title><style>
      body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
      h1 { font-size: 1.5rem; } h2 { font-size: 1.2rem; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px; }
      h3 { font-size: 1rem; } table { border-collapse: collapse; width: 100%; margin: 12px 0; }
      th, td { border: 1px solid #e5e5e5; padding: 6px 12px; text-align: left; font-size: 0.85rem; }
      li { font-size: 0.85rem; } hr { margin: 16px 0; border: none; border-top: 1px solid #e5e5e5; }
    </style></head><body>`);
    const html = report
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^---$/gm, '<hr>')
      .replace(/^\| (.+) \|$/gm, (match) => {
        const cells = match.split('|').filter(Boolean).map(c => c.trim());
        return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
      })
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n/g, '<br>');
    w.document.write(html);
    w.document.write('</body></html>');
    w.document.close();
    w.print();
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
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Informe emitido y guardado');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Emitir Informe Ejecutivo</DialogTitle>
          <DialogDescription>Informe de temas activos con semáforos de atraso y novedades.</DialogDescription>
        </DialogHeader>

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

        <div className="flex-1 overflow-auto rounded-md border border-border bg-muted/30 p-4">
          <pre className="text-xs whitespace-pre-wrap font-mono text-foreground leading-relaxed">{report}</pre>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="h-3 w-3 mr-1" /> Copiar</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-3 w-3 mr-1" /> Imprimir</Button>
          <Button size="sm" onClick={handleEmit} disabled={saving}>
            <Save className="h-3 w-3 mr-1" />
            {saving ? 'Emitiendo...' : 'Emitir Informe'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
