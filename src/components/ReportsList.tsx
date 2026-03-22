import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, FileDown, Plus, Search, CalendarIcon } from 'lucide-react';
import { downloadPdfFromContent } from '@/lib/generateReportPdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ReportsListProps {
  onNewReport: () => void;
}

export function ReportsList({ onNewReport }: ReportsListProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reports').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Informe eliminado');
    },
  });

  const filtered = reports.filter(r => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.title.toLowerCase().includes(q)) return false;
    }
    if (dateFrom) {
      const created = parseISO(r.created_at);
      if (isBefore(created, startOfDay(dateFrom))) return false;
    }
    if (dateTo) {
      const created = parseISO(r.created_at);
      if (isAfter(created, endOfDay(dateTo))) return false;
    }
    return true;
  });

  const handleDownloadPdf = (content: string, title: string, periodStart: string, periodEnd: string) => {
    downloadPdfFromContent(content, title, periodStart, periodEnd);
    toast.success('PDF descargado');
  };

  const clearFilters = () => {
    setSearch('');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Historial de Informes</h2>
        <Button size="sm" className="h-8 gap-1 text-xs" onClick={onNewReport}>
          <Plus className="h-3 w-3" /> Nuevo Informe
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <CalendarIcon className="mr-1 h-3 w-3" />
              {dateFrom ? format(dateFrom, 'dd/MM/yy') : 'Desde'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn('p-3 pointer-events-auto')} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <CalendarIcon className="mr-1 h-3 w-3" />
              {dateTo ? format(dateTo, 'dd/MM/yy') : 'Hasta'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn('p-3 pointer-events-auto')} />
          </PopoverContent>
        </Popover>
        {(search || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            Limpiar
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando informes...</p>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {reports.length === 0 ? 'No hay informes emitidos aún.' : 'No hay informes que coincidan con tu búsqueda.'}
          </p>
          {reports.length === 0 && (
            <Button size="sm" className="mt-3 text-xs" onClick={onNewReport}>
              Emitir primer informe
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className="rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-card-foreground">{r.title}</h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Emitido: {format(parseISO(r.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Período: {format(parseISO(r.period_start), 'dd MMM', { locale: es })} — {format(parseISO(r.period_end), 'dd MMM yyyy', { locale: es })}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDownloadPdf(r.content, r.title, r.period_start, r.period_end)}>
                    <FileDown className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => deleteReport.mutate(r.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
