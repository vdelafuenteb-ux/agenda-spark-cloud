import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Copy, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { TopicWithSubtasks } from '@/hooks/useTopics';

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topics: TopicWithSubtasks[];
}

type Period = 'week' | 'month' | 'custom';

export function ReportModal({ open, onOpenChange, topics }: ReportModalProps) {
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

  const report = useMemo(() => {
    const active = topics.filter(t => t.status === 'activo');
    const completed = topics.filter(t => t.status === 'completado');
    const paused = topics.filter(t => t.status === 'pausado');
    const totalSubs = topics.reduce((a, t) => a + t.subtasks.length, 0);
    const doneSubs = topics.reduce((a, t) => a + t.subtasks.filter(s => s.completed).length, 0);
    const pct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;

    const periodStr = `${format(start, 'dd MMM yyyy', { locale: es })} — ${format(end, 'dd MMM yyyy', { locale: es })}`;

    let md = `# Informe Ejecutivo\n\n`;
    md += `**Período:** ${periodStr}\n\n`;
    md += `## Resumen General\n\n`;
    md += `| Indicador | Valor |\n|---|---|\n`;
    md += `| Temas activos | ${active.length} |\n`;
    md += `| Temas completados | ${completed.length} |\n`;
    md += `| Temas pausados | ${paused.length} |\n`;
    md += `| Subtareas completadas | ${doneSubs}/${totalSubs} (${pct}%) |\n\n`;

    md += `## Detalle por Tema\n\n`;

    const renderTopicSection = (list: TopicWithSubtasks[], sectionTitle: string) => {
      if (list.length === 0) return '';
      let section = `### ${sectionTitle}\n\n`;
      list.forEach(t => {
        const tDone = t.subtasks.filter(s => s.completed).length;
        const tTotal = t.subtasks.length;
        section += `#### ${t.title}\n`;
        section += `- **Prioridad:** ${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}\n`;
        section += `- **Estado:** ${t.status.charAt(0).toUpperCase() + t.status.slice(1)}\n`;
        if (t.due_date) section += `- **Fecha cierre:** ${format(new Date(t.due_date), 'dd MMM yyyy', { locale: es })}\n`;
        if (tTotal > 0) section += `- **Progreso:** ${tDone}/${tTotal} subtareas completadas\n`;

        if (t.subtasks.length > 0) {
          section += `- **Subtareas:**\n`;
          t.subtasks.forEach(s => {
            section += `  - [${s.completed ? 'x' : ' '}] ${s.title}\n`;
          });
        }

        if (t.progress_notes) {
          section += `- **Avances:** ${t.progress_notes}\n`;
        }
        section += '\n';
      });
      return section;
    };

    md += renderTopicSection(active, 'Temas Activos');
    md += renderTopicSection(completed, 'Temas Completados');
    md += renderTopicSection(paused, 'Temas Pausados');

    md += `---\n*Generado el ${format(new Date(), "dd MMM yyyy 'a las' HH:mm", { locale: es })}*\n`;

    return md;
  }, [topics, start, end]);

  const handleCopy = () => {
    navigator.clipboard.writeText(report);
    toast.success('Informe copiado al portapapeles');
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Informe</title><style>
      body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
      h1 { font-size: 1.5rem; } h2 { font-size: 1.2rem; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px; }
      h3 { font-size: 1rem; } h4 { font-size: 0.9rem; margin-bottom: 4px; }
      table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #e5e5e5; padding: 6px 12px; text-align: left; font-size: 0.85rem; }
      li { font-size: 0.85rem; } hr { margin-top: 24px; border: none; border-top: 1px solid #e5e5e5; }
    </style></head><body>`);
    // Simple md→html
    const html = report
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
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
      .replace(/^  - (.+)$/gm, '<li style="margin-left:20px">$1</li>')
      .replace(/\n/g, '<br>');
    w.document.write(html);
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('reports').insert({
        user_id: user.id,
        title: `Informe ${format(start, 'dd MMM', { locale: es })} - ${format(end, 'dd MMM yyyy', { locale: es })}`,
        content: report,
        period_start: format(start, 'yyyy-MM-dd'),
        period_end: format(end, 'yyyy-MM-dd'),
      });
      if (error) throw error;
      toast.success('Informe guardado');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Emitir Informe</DialogTitle>
          <DialogDescription>Genera un resumen ejecutivo de tus temas y avances.</DialogDescription>
        </DialogHeader>

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['week', 'month', 'custom'] as Period[]).map(p => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setPeriod(p)}
            >
              {p === 'week' ? 'Esta semana' : p === 'month' ? 'Este mes' : 'Personalizado'}
            </Button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {format(customStart, 'dd/MM')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customStart} onSelect={d => d && setCustomStart(d)} className="p-3 pointer-events-auto" /></PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">a</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {format(customEnd, 'dd/MM')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customEnd} onSelect={d => d && setCustomEnd(d)} className="p-3 pointer-events-auto" /></PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {/* Report preview */}
        <div className="flex-1 overflow-auto rounded-md border border-border bg-muted/30 p-4">
          <pre className="text-xs whitespace-pre-wrap font-mono text-foreground leading-relaxed">{report}</pre>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-3 w-3 mr-1" /> Copiar
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-3 w-3 mr-1" /> Imprimir
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar informe'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
