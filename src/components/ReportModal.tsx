import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isAfter, isBefore, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, FileDown, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { parseStoredDate } from '@/lib/date';
import { downloadReportPdf } from '@/lib/generateReportPdf';
import { useQueryClient } from '@tanstack/react-query';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import { useDepartments } from '@/hooks/useDepartments';

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topics: TopicWithSubtasks[];
}

type Period = 'week' | 'month' | 'custom';

function getTrafficLightLabel(dueDateStr: string | null | undefined): 'Atrasado' | 'Por vencer' | 'Al día' | 'Sin fecha' {
  if (!dueDateStr) return 'Sin fecha';
  const d = parseStoredDate(dueDateStr);
  if (!d) return 'Sin fecha';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dc = new Date(d); dc.setHours(0, 0, 0, 0);
  if (isBefore(dc, today)) return 'Atrasado';
  if (isBefore(dc, addDays(today, 4))) return 'Por vencer';
  return 'Al día';
}

export function ReportModal({ open, onOpenChange, topics }: ReportModalProps) {
  const queryClient = useQueryClient();
  const { departments } = useDepartments();
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState<Date>(subDays(new Date(), 30));
  const [customEnd, setCustomEnd] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  // Config básica
  const [reportTitle, setReportTitle] = useState('Informe Ejecutivo');
  const [authorName, setAuthorName] = useState('Matías Sapunar');
  const [authorRole, setAuthorRole] = useState('Gerente de Administración y Finanzas');

  // Toggles simplificados
  const [includeBitacora, setIncludeBitacora] = useState(false);
  const [includeResponsables, setIncludeResponsables] = useState(true);

  const { start, end } = useMemo(() => {
    const now = new Date();
    if (period === 'week') return { start: startOfWeek(now, { locale: es }), end: endOfWeek(now, { locale: es }) };
    if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now) };
    return { start: customStart, end: customEnd };
  }, [period, customStart, customEnd]);

  // Conteos para preview en el modal
  const counts = useMemo(() => {
    const active = topics.filter(t => t.status === 'activo' || t.status === 'seguimiento');
    const paused = topics.filter(t => t.status === 'pausado');
    const closed = topics.filter(t => {
      if (t.status !== 'completado') return false;
      if (!t.closed_at) return true;
      const c = new Date(t.closed_at);
      return !isBefore(c, start) && !isAfter(c, addDays(end, 1));
    });
    const overdue = active.filter(t => getTrafficLightLabel(t.due_date) === 'Atrasado').length;
    return { active: active.length, paused: paused.length, closed: closed.length, overdue, total: topics.length };
  }, [topics, start, end]);

  const buildPdfOptions = () => ({
    topics,
    periodStart: start,
    periodEnd: end,
    title: reportTitle,
    authorName: authorName || undefined,
    authorRole: authorRole || undefined,
    includeBitacora,
    includeResponsables,
    departments,
  });

  const handleDownloadPdf = () => {
    downloadReportPdf(buildPdfOptions());
    toast.success('PDF descargado');
  };

  // Resumen markdown breve para guardar referencia en BD
  const buildSummaryMarkdown = () => {
    const periodStr = `${format(start, 'dd MMM yyyy', { locale: es })} — ${format(end, 'dd MMM yyyy', { locale: es })}`;
    let md = `# ${reportTitle}\n\n`;
    md += `**Período:** ${periodStr}\n`;
    if (authorName) md += `**Elaborado por:** ${authorName}${authorRole ? ` — ${authorRole}` : ''}\n`;
    md += `\n## Indicadores\n\n`;
    md += `- Temas totales: ${counts.total}\n`;
    md += `- Activos: ${counts.active}\n`;
    md += `- Pausados: ${counts.paused}\n`;
    md += `- Cerrados (en período): ${counts.closed}\n`;
    md += `- Atrasados: ${counts.overdue}\n`;
    return md;
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
        content: buildSummaryMarkdown(),
        period_start: format(start, 'yyyy-MM-dd'),
        period_end: format(end, 'yyyy-MM-dd'),
      });
      if (error) throw error;
      downloadReportPdf(buildPdfOptions());
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Informe emitido y PDF descargado');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-5 p-6">
        <DialogHeader className="pb-0">
          <DialogTitle className="text-lg">Generar Informe Ejecutivo</DialogTitle>
          <DialogDescription className="text-xs">
            Estructura limpia en 3 secciones: activos, pausados y cerrados en el período seleccionado.
          </DialogDescription>
        </DialogHeader>

        {/* Datos del informe */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <Input
              value={reportTitle}
              onChange={e => setReportTitle(e.target.value)}
              placeholder="Título del informe"
              className="h-9"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                placeholder="Tu nombre"
                className="h-9"
              />
              <Input
                value={authorRole}
                onChange={e => setAuthorRole(e.target.value)}
                placeholder="Cargo / Rol"
                className="h-9"
              />
            </div>
          </div>

          {/* Período */}
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Período</div>
            <div className="flex items-center gap-2 flex-wrap">
              {(['week', 'month', 'custom'] as Period[]).map(value => (
                <Button
                  key={value}
                  size="sm"
                  variant={period === value ? 'default' : 'outline'}
                  className="h-8 text-xs"
                  onClick={() => setPeriod(value)}
                >
                  {value === 'week' ? 'Esta semana' : value === 'month' ? 'Este mes' : 'Personalizado'}
                </Button>
              ))}
              {period === 'custom' && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {format(customStart, 'dd MMM yyyy', { locale: es })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customStart} onSelect={d => d && setCustomStart(d)} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <span className="text-xs text-muted-foreground">→</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {format(customEnd, 'dd MMM yyyy', { locale: es })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customEnd} onSelect={d => d && setCustomEnd(d)} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              El período filtra los <strong>temas cerrados</strong> por su fecha de cierre. Activos y pausados se incluyen siempre.
            </p>
          </div>

          {/* Opciones */}
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Contenido</div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center justify-between cursor-pointer rounded-md border border-border px-3 py-2">
                <div>
                  <div className="text-xs font-medium">Resumen por responsable</div>
                  <div className="text-[10px] text-muted-foreground">Tabla con totales por persona en página 1</div>
                </div>
                <Switch checked={includeResponsables} onCheckedChange={setIncludeResponsables} />
              </label>
              <label className="flex items-center justify-between cursor-pointer rounded-md border border-border px-3 py-2">
                <div>
                  <div className="text-xs font-medium">Incluir bitácora</div>
                  <div className="text-[10px] text-muted-foreground">Último avance de cada tema activo</div>
                </div>
                <Switch checked={includeBitacora} onCheckedChange={setIncludeBitacora} />
              </label>
            </div>
          </div>

          {/* Preview de conteos */}
          <div className="grid grid-cols-4 gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{counts.total}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Total</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{counts.active}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Activos</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-600">{counts.paused}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Pausados</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{counts.closed}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Cerrados</div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-9" onClick={handleDownloadPdf}>
            <FileDown className="h-4 w-4 mr-2" /> Descargar PDF
          </Button>
          <Button size="sm" className="h-9" onClick={handleEmit} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar y descargar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
