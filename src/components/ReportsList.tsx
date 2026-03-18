import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, Copy, Printer, Plus, Search, CalendarIcon, ChevronDown, ChevronRight } from 'lucide-react';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copiado');
  };

  const handlePrint = (content: string, title: string) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>${title}</title><style>
      body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
      h1 { font-size: 1.5rem; } h2 { font-size: 1.2rem; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px; }
      h3 { font-size: 1rem; } table { border-collapse: collapse; width: 100%; margin: 12px 0; }
      th, td { border: 1px solid #e5e5e5; padding: 6px 12px; text-align: left; font-size: 0.85rem; }
      li { font-size: 0.85rem; } hr { margin: 16px 0; border: none; border-top: 1px solid #e5e5e5; }
      pre { white-space: pre-wrap; font-size: 0.85rem; }
    </style></head><body><pre>${content}</pre></body></html>`);
    w.document.close();
    w.print();
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
        <Button size="sm" className="h-8 text-xs gap-1" onClick={onNewReport}>
          <Plus className="h-3 w-3" /> Nuevo Informe
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por título..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <CalendarIcon className="h-3 w-3 mr-1" />
              {dateFrom ? format(dateFrom, 'dd/MM/yy') : 'Desde'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <CalendarIcon className="h-3 w-3 mr-1" />
              {dateTo ? format(dateTo, 'dd/MM/yy') : 'Hasta'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        {(search || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>Limpiar</Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Cargando informes...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            {reports.length === 0 ? 'No hay informes emitidos aún.' : 'No hay informes que coincidan con tu búsqueda.'}
          </p>
          {reports.length === 0 && (
            <Button size="sm" className="mt-3 text-xs" onClick={onNewReport}>Emitir primer informe</Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="bg-card rounded-lg border border-border shadow-sm">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-card-foreground truncate">{r.title}</h3>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        Emitido: {format(parseISO(r.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Período: {format(parseISO(r.period_start), 'dd MMM', { locale: es })} — {format(parseISO(r.period_end), 'dd MMM yyyy', { locale: es })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleCopy(r.content)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handlePrint(r.content, r.title)}>
                      <Printer className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteReport.mutate(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-border p-4">
                    <pre className="text-xs whitespace-pre-wrap font-mono text-foreground/80 leading-relaxed">{r.content}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
