import { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Mail, CheckCircle2, Search, X, CalendarIcon, Trash2, Clock, ChevronDown, ChevronRight, FileText } from 'lucide-react';
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
  confirmed: boolean;
  confirmed_at: string | null;
  topic_title?: string;
}

interface EmailBatch {
  key: string;
  assignee_name: string;
  assignee_email: string;
  sent_at: string;
  emails: EmailRecord[];
  allConfirmed: boolean;
  topicCount: number;
}

export function EmailHistoryView() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['notification_emails_all'],
    queryFn: async (): Promise<EmailRecord[]> => {
      const { data, error } = await supabase
        .from('notification_emails')
        .select('*, topics(title)')
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        topic_title: row.topics?.title || 'Tema eliminado',
      })) as EmailRecord[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['notification_emails_all'] });
    queryClient.invalidateQueries({ queryKey: ['notification_emails'] });
  };

  const toggleConfirmed = useMutation({
    mutationFn: async ({ id, confirmed }: { id: string; confirmed: boolean }) => {
      const { error } = await supabase
        .from('notification_emails')
        .update({
          confirmed,
          confirmed_at: confirmed ? new Date().toISOString() : null,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const toggleBatchConfirmed = useMutation({
    mutationFn: async ({ ids, confirmed }: { ids: string[]; confirmed: boolean }) => {
      const { error } = await supabase
        .from('notification_emails')
        .update({
          confirmed,
          confirmed_at: confirmed ? new Date().toISOString() : null,
        } as any)
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const deleteEmail = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notification_emails').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Registro eliminado');
    },
  });

  const deleteBatch = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('notification_emails').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Registros eliminados');
    },
  });

  const uniqueAssignees = useMemo(() => {
    return [...new Set(emails.map(e => e.assignee_name))].sort();
  }, [emails]);

  // Group emails into batches by assignee + close timestamps (within 60 seconds)
  const batches = useMemo(() => {
    const sorted = [...emails].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    const groups: EmailBatch[] = [];

    sorted.forEach(email => {
      const emailTime = new Date(email.sent_at).getTime();
      const existing = groups.find(
        g => g.assignee_email === email.assignee_email && Math.abs(new Date(g.sent_at).getTime() - emailTime) < 60000
      );
      if (existing) {
        existing.emails.push(email);
        existing.allConfirmed = existing.emails.every(e => e.confirmed);
        existing.topicCount = existing.emails.length;
      } else {
        groups.push({
          key: `${email.assignee_email}-${email.sent_at}`,
          assignee_name: email.assignee_name,
          assignee_email: email.assignee_email,
          sent_at: email.sent_at,
          emails: [email],
          allConfirmed: email.confirmed,
          topicCount: 1,
        });
      }
    });

    return groups;
  }, [emails]);

  const filtered = useMemo(() => {
    return batches.filter(b => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!b.assignee_name.toLowerCase().includes(q) && !b.assignee_email.toLowerCase().includes(q)) return false;
      }
      if (selectedAssignee !== 'all' && b.assignee_name !== selectedAssignee) return false;
      if (statusFilter === 'pending' && b.allConfirmed) return false;
      if (statusFilter === 'confirmed' && !b.allConfirmed) return false;
      if (dateFrom && new Date(b.sent_at) < dateFrom) return false;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (new Date(b.sent_at) > endOfDay) return false;
      }
      return true;
    });
  }, [batches, searchQuery, selectedAssignee, statusFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const confirmed = filtered.filter(b => b.allConfirmed).length;
    const pending = total - confirmed;
    return { total, confirmed, pending };
  }, [filtered]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedAssignee('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setStatusFilter('all');
  };

  const hasFilters = searchQuery || selectedAssignee !== 'all' || dateFrom || dateTo || statusFilter !== 'all';

  const toggleExpand = (key: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
            <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Confirmados</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.pending}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Pendientes</p>
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

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="confirmed">Confirmados</SelectItem>
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
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8"></th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Confirmado</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Estado</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Persona</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Temas</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Enviado</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(batch => {
                    const isExpanded = expandedBatches.has(batch.key);
                    const batchIds = batch.emails.map(e => e.id);

                    return (
                      <Fragment key={batch.key}>
                        <tr
                          className={cn(
                            "border-b border-border last:border-0 transition-colors hover:bg-muted/30 cursor-pointer",
                            batch.allConfirmed && "bg-green-50/50 dark:bg-green-950/10"
                          )}
                          onClick={() => toggleExpand(batch.key)}
                        >
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </td>
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={batch.allConfirmed}
                              onCheckedChange={(checked) => toggleBatchConfirmed.mutate({ ids: batchIds, confirmed: !!checked })}
                              className="h-4 w-4"
                              title={batch.allConfirmed ? 'Desmarcar confirmación' : 'Confirmar todos'}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            {batch.allConfirmed ? (
                              <span className="inline-flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                <span className="text-[10px] font-medium">Confirmado</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <Badge variant="outline" className="text-[10px]">Pendiente</Badge>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-foreground">{batch.assignee_name}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{batch.assignee_email}</td>
                          <td className="px-3 py-2.5">
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <FileText className="h-2.5 w-2.5" />
                              {batch.topicCount} {batch.topicCount === 1 ? 'tema' : 'temas'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground font-mono">
                            {format(new Date(batch.sent_at), "dd MMM yyyy HH:mm", { locale: es })}
                          </td>
                          <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => deleteBatch.mutate(batchIds)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title="Eliminar registros"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="bg-muted/20 px-0 py-0">
                              <div className="px-8 py-2 space-y-1">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
                                  Temas incluidos en este envío
                                </p>
                                {batch.emails.map((email, i) => (
                                  <div key={email.id} className="flex items-center justify-between gap-2 py-1 border-b border-border/50 last:border-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-muted-foreground w-4">{i + 1}.</span>
                                      <span className="text-xs text-foreground">{email.topic_title}</span>
                                    </div>
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                      {email.confirmed ? (
                                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                                      ) : (
                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                      )}
                                      <Checkbox
                                        checked={email.confirmed}
                                        onCheckedChange={(checked) => toggleConfirmed.mutate({ id: email.id, confirmed: !!checked })}
                                        className="h-3.5 w-3.5"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
