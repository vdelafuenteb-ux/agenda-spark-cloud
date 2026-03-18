import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Mail, CheckCircle2, Search, X, CalendarIcon, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EmailRecord {
  id: string;
  user_id: string;
  topic_id: string;
  assignee_name: string;
  assignee_email: string;
  sent_at: string;
  responded: boolean;
  responded_at: string | null;
}

export function EmailHistoryView() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [respondedFilter, setRespondedFilter] = useState<string>('all');

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['notification_emails_all'],
    queryFn: async (): Promise<EmailRecord[]> => {
      const { data, error } = await supabase
        .from('notification_emails')
        .select('*')
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as EmailRecord[];
    },
  });

  const toggleResponded = useMutation({
    mutationFn: async ({ id, responded }: { id: string; responded: boolean }) => {
      const { error } = await supabase
        .from('notification_emails')
        .update({
          responded,
          responded_at: responded ? new Date().toISOString() : null,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_emails_all'] });
      queryClient.invalidateQueries({ queryKey: ['notification_emails'] });
    },
  });

  const deleteEmail = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notification_emails').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_emails_all'] });
      queryClient.invalidateQueries({ queryKey: ['notification_emails'] });
      toast.success('Registro eliminado');
    },
  });

  const uniqueAssignees = useMemo(() => {
    const names = [...new Set(emails.map(e => e.assignee_name))].sort();
    return names;
  }, [emails]);

  const filtered = useMemo(() => {
    return emails.filter(e => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!e.assignee_name.toLowerCase().includes(q) && !e.assignee_email.toLowerCase().includes(q)) return false;
      }
      if (selectedAssignee !== 'all' && e.assignee_name !== selectedAssignee) return false;
      if (respondedFilter === 'yes' && !e.responded) return false;
      if (respondedFilter === 'no' && e.responded) return false;
      if (dateFrom) {
        const sentDate = new Date(e.sent_at);
        if (sentDate < dateFrom) return false;
      }
      if (dateTo) {
        const sentDate = new Date(e.sent_at);
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (sentDate > endOfDay) return false;
      }
      return true;
    });
  }, [emails, searchQuery, selectedAssignee, respondedFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const responded = filtered.filter(e => e.responded).length;
    const pending = total - responded;
    return { total, responded, pending };
  }, [filtered]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedAssignee('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setRespondedFilter('all');
  };

  const hasFilters = searchQuery || selectedAssignee !== 'all' || dateFrom || dateTo || respondedFilter !== 'all';

  return (
    <div className="flex-1 overflow-auto p-3 md:p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total enviados</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.responded}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Respondidos</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.pending}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Sin respuesta</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Persona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las personas</SelectItem>
              {uniqueAssignees.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={respondedFilter} onValueChange={setRespondedFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="yes">Respondidos</SelectItem>
              <SelectItem value="no">Sin respuesta</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", dateFrom && "text-foreground")}>
                <CalendarIcon className="h-3 w-3" />
                {dateFrom ? format(dateFrom, "dd MMM yy", { locale: es }) : "Desde"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", dateTo && "text-foreground")}>
                <CalendarIcon className="h-3 w-3" />
                {dateTo ? format(dateTo, "dd MMM yy", { locale: es }) : "Hasta"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearFilters}>
              <X className="h-3 w-3" />
              Limpiar
            </Button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Cargando historial...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {hasFilters ? 'No hay correos que coincidan con los filtros.' : 'Aún no se han enviado correos de notificación.'}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Estado</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Persona</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Enviado</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Respondido</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(email => (
                    <tr
                      key={email.id}
                      className={cn(
                        "border-b border-border last:border-0 transition-colors hover:bg-muted/30",
                        email.responded && "bg-green-50/50 dark:bg-green-950/10"
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={email.responded}
                          onCheckedChange={(checked) => toggleResponded.mutate({ id: email.id, responded: !!checked })}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{email.assignee_name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{email.assignee_email}</td>
                      <td className="px-3 py-2.5 text-muted-foreground font-mono">
                        {format(new Date(email.sent_at), "dd MMM yyyy HH:mm", { locale: es })}
                      </td>
                      <td className="px-3 py-2.5">
                        {email.responded ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {email.responded_at && format(new Date(email.responded_at), "dd MMM yy", { locale: es })}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Pendiente</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => deleteEmail.mutate(email.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Eliminar registro"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
