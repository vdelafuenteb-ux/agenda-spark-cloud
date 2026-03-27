import { useState, useMemo, Fragment, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Mail, CheckCircle2, Search, X, CalendarIcon, Trash2, Clock, ChevronDown, ChevronRight, FileText, AlertTriangle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  email_type?: string;
  reviewed: boolean;
  reviewed_at: string | null;
}

interface EmailBatch {
  key: string;
  assignee_name: string;
  assignee_email: string;
  sent_at: string;
  emails: EmailRecord[];
  allConfirmed: boolean;
  allReviewed: boolean;
  topicCount: number;
}

const DEADLINE_HOURS = 48;

function getDeadlineInfo(sentAt: string, confirmed: boolean, confirmedAt?: string | null) {
  const sentTime = new Date(sentAt).getTime();
  const deadlineTime = sentTime + DEADLINE_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  const diffMs = deadlineTime - now;
  const isOverdue = diffMs <= 0 && !confirmed;
  const totalMinutes = Math.abs(Math.floor(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (confirmed && confirmedAt) {
    const confirmedTime = new Date(confirmedAt).getTime();
    const onTime = confirmedTime <= deadlineTime;
    return {
      label: onTime ? 'A tiempo' : 'Fuera de plazo',
      isOverdue: false,
      color: onTime ? 'text-green-600' : 'text-destructive',
      onTime,
    };
  }
  if (confirmed) {
    return { label: 'Respondido', isOverdue: false, color: 'text-green-600', onTime: true };
  }
  if (isOverdue) {
    return { label: `−${hours}h ${minutes}m`, isOverdue: true, color: 'text-destructive', onTime: false };
  }
  return { label: `${hours}h ${minutes}m`, isOverdue: false, color: 'text-amber-600', onTime: false };
}

function toLocalDatetime(isoStr: string) {
  const d = new Date(isoStr);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function ConfirmDatetimePopover({
  emailId,
  sentAt,
  onConfirm,
}: {
  emailId: string;
  sentAt: string;
  onConfirm: (id: string, confirmedAt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(toLocalDatetime(new Date().toISOString()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Checkbox
          checked={false}
          onCheckedChange={() => setOpen(true)}
          className="h-3.5 w-3.5"
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 space-y-2" align="end" onClick={e => e.stopPropagation()}>
        <p className="text-xs font-medium">¿Cuándo respondió?</p>
        <Input
          type="datetime-local"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="h-8 text-xs"
        />
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              onConfirm(emailId, new Date(value).toISOString());
              setOpen(false);
            }}
          >
            Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EmailHistoryView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'weekly' | 'new_topic'>('weekly');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

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
    queryClient.invalidateQueries({ queryKey: ['notification_emails'] });
    queryClient.invalidateQueries({ queryKey: ['notification_emails_all'] });
    queryClient.invalidateQueries({ queryKey: ['notification_emails_all_dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['notification_emails_team'] });
    queryClient.invalidateQueries({ queryKey: ['notification_emails_assignee'] });
  };

  const toggleConfirmed = useMutation({
    mutationFn: async ({ id, confirmed, confirmed_at }: { id: string; confirmed: boolean; confirmed_at?: string }) => {
      const { error } = await supabase
        .from('notification_emails')
        .update({
          confirmed,
          confirmed_at: confirmed ? (confirmed_at || new Date().toISOString()) : null,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const toggleBatchConfirmed = useMutation({
    mutationFn: async ({ ids, confirmed, confirmed_at }: { ids: string[]; confirmed: boolean; confirmed_at?: string }) => {
      const { error } = await supabase
        .from('notification_emails')
        .update({
          confirmed,
          confirmed_at: confirmed ? (confirmed_at || new Date().toISOString()) : null,
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

  const toggleReviewed = useMutation({
    mutationFn: async ({ id, reviewed }: { id: string; reviewed: boolean }) => {
      const { error } = await supabase
        .from('notification_emails')
        .update({
          reviewed,
          reviewed_at: reviewed ? new Date().toISOString() : null,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
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

  const weeklyEmails = useMemo(() => emails.filter(e => (e.email_type || 'weekly') === 'weekly'), [emails]);
  const newTopicEmails = useMemo(() => emails.filter(e => e.email_type === 'new_topic'), [emails]);

  const activeEmails = activeTab === 'weekly' ? weeklyEmails : newTopicEmails;

  const uniqueAssignees = useMemo(() => {
    return [...new Set(activeEmails.map(e => e.assignee_name))].sort();
  }, [activeEmails]);

  const batches = useMemo(() => {
    const sorted = [...activeEmails].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    const groups: EmailBatch[] = [];

    sorted.forEach(email => {
      const emailTime = new Date(email.sent_at).getTime();
      const existing = groups.find(
        g => g.assignee_email === email.assignee_email && Math.abs(new Date(g.sent_at).getTime() - emailTime) < 60000
      );
      if (existing) {
        existing.emails.push(email);
        existing.allConfirmed = existing.emails.every(e => e.confirmed);
        existing.allReviewed = existing.emails.every(e => e.reviewed);
        existing.topicCount = existing.emails.length;
      } else {
        groups.push({
          key: `${email.assignee_email}-${email.sent_at}`,
          assignee_name: email.assignee_name,
          assignee_email: email.assignee_email,
          sent_at: email.sent_at,
          emails: [email],
          allConfirmed: email.confirmed,
          allReviewed: email.reviewed,
          topicCount: 1,
        });
      }
    });

    return groups;
  }, [activeEmails]);

  const filtered = useMemo(() => {
    return batches.filter(b => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!b.assignee_name.toLowerCase().includes(q) && !b.assignee_email.toLowerCase().includes(q)) return false;
      }
      if (selectedAssignee !== 'all' && b.assignee_name !== selectedAssignee) return false;
      if (statusFilter === 'pending' && b.allConfirmed) return false;
      if (statusFilter === 'confirmed' && !b.allConfirmed) return false;
      if (statusFilter === 'overdue') {
        const info = getDeadlineInfo(b.sent_at, b.allConfirmed);
        if (!info.isOverdue) return false;
      }
      if (statusFilter === 'reviewed' && !b.allReviewed) return false;
      if (statusFilter === 'not_reviewed' && b.allReviewed) return false;
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
    const overdue = filtered.filter(b => getDeadlineInfo(b.sent_at, b.allConfirmed).isOverdue).length;
    return { total, confirmed, pending, overdue };
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

  const handleConfirmEmail = (id: string, confirmedAt: string) => {
    toggleConfirmed.mutate({ id, confirmed: true, confirmed_at: confirmedAt });
  };

  const handleUnconfirmEmail = (id: string) => {
    toggleConfirmed.mutate({ id, confirmed: false });
  };

  const isWeekly = activeTab === 'weekly';

  return (
    <div className="flex-1 overflow-auto p-3 md:p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setExpandedBatches(new Set()); clearFilters(); }}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="weekly" className="text-xs gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Seguimiento semanal
            </TabsTrigger>
            <TabsTrigger value="new_topic" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Temas adicionales
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {/* Stats - only for weekly */}
        {isWeekly && (
        <div className="grid grid-cols-4 gap-3">
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
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.overdue}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Fuera de plazo
            </p>
          </div>
        </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:flex-1 sm:min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
            <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
              <SelectValue placeholder="Persona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las personas</SelectItem>
              {uniqueAssignees.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isWeekly && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="confirmed">Confirmados</SelectItem>
              <SelectItem value="overdue">Fuera de plazo</SelectItem>
              <SelectItem value="reviewed">Revisados</SelectItem>
              <SelectItem value="not_reviewed">No revisados</SelectItem>
            </SelectContent>
          </Select>
          )}

          <div className="flex gap-2 w-full sm:w-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1 flex-1 sm:flex-none", dateFrom && "text-foreground")}>
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
                <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1 flex-1 sm:flex-none", dateTo && "text-foreground")}>
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
          <>
          {/* Desktop table */}
          <div className="rounded-lg border border-border overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8"></th>
                    {isWeekly && <th className="text-left px-3 py-2 font-medium text-muted-foreground">Confirmado</th>}
                    {isWeekly && <th className="text-left px-3 py-2 font-medium text-muted-foreground">Estado</th>}
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Persona</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Temas</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Enviado</th>
                    {isWeekly && <th className="text-left px-3 py-2 font-medium text-muted-foreground">Plazo 48h</th>}
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(batch => {
                    const isExpanded = expandedBatches.has(batch.key);
                    const batchIds = batch.emails.map(e => e.id);
                    // For batch-level deadline, use the first email's confirmed_at if all confirmed
                    const batchConfirmedAt = batch.allConfirmed ? batch.emails[0]?.confirmed_at : null;
                    const deadline = getDeadlineInfo(batch.sent_at, batch.allConfirmed, batchConfirmedAt);

                    return (
                      <Fragment key={batch.key}>
                        <tr
                          className={cn(
                            "border-b border-border last:border-0 transition-colors hover:bg-muted/30 cursor-pointer",
                            isWeekly && batch.allConfirmed && "bg-green-50/50 dark:bg-green-950/10",
                            isWeekly && deadline.isOverdue && "bg-red-50 dark:bg-red-950/20"
                          )}
                          onClick={() => toggleExpand(batch.key)}
                        >
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </td>
                          {isWeekly && (
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            {batch.allConfirmed ? (
                              <Checkbox
                                checked={true}
                                onCheckedChange={() => {
                                  batchIds.forEach(id => handleUnconfirmEmail(id));
                                }}
                                className="h-4 w-4"
                              />
                            ) : (
                              <ConfirmDatetimePopover
                                emailId={batchIds[0]}
                                sentAt={batch.sent_at}
                                onConfirm={(_, confirmedAt) => {
                                  toggleBatchConfirmed.mutate({ ids: batchIds, confirmed: true, confirmed_at: confirmedAt });
                                }}
                              />
                            )}
                          </td>
                          )}
                          {isWeekly && (
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
                          )}
                          {!isWeekly && (
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              <span className="text-[10px] font-medium">Enviado</span>
                            </span>
                          </td>
                          )}
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
                          {isWeekly && (
                          <td className="px-3 py-2.5">
                            <span className={cn("font-mono font-medium text-[11px] inline-flex items-center gap-1", deadline.color)}>
                              {deadline.isOverdue && <AlertTriangle className="h-3 w-3" />}
                              {deadline.label}
                            </span>
                          </td>
                          )}
                          <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => deleteBatch.mutate(batchIds)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={isWeekly ? 9 : 6} className="bg-muted/20 px-0 py-0">
                              <div className="px-8 py-2 space-y-1">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
                                  Temas incluidos en este envío
                                </p>
                                {batch.emails.map((email, i) => {
                                  const emailDeadline = getDeadlineInfo(email.sent_at, email.confirmed, email.confirmed_at);
                                  return (
                                    <div key={email.id} className="flex items-center justify-between gap-2 py-1 border-b border-border/50 last:border-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground w-4">{i + 1}.</span>
                                        <span className="text-xs text-foreground">{email.topic_title}</span>
                                      </div>
                                      {isWeekly ? (
                                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        {email.confirmed ? (
                                          <>
                                            <span className={cn("text-[10px] font-medium", emailDeadline.color)}>
                                              {emailDeadline.label}
                                            </span>
                                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                                            <Checkbox
                                              checked={true}
                                              onCheckedChange={() => handleUnconfirmEmail(email.id)}
                                              className="h-3.5 w-3.5"
                                            />
                                          </>
                                        ) : (
                                          <>
                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                            <ConfirmDatetimePopover
                                              emailId={email.id}
                                              sentAt={email.sent_at}
                                              onConfirm={handleConfirmEmail}
                                            />
                                          </>
                                        )}
                                      </div>
                                      ) : (
                                      <span className="text-[10px] text-muted-foreground">Informativo</span>
                                      )}
                                    </div>
                                  );
                                })}
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

          {/* Mobile card layout */}
          <div className="md:hidden space-y-2">
            {filtered.map(batch => {
              const isExpanded = expandedBatches.has(batch.key);
              const batchIds = batch.emails.map(e => e.id);
              const batchConfirmedAt = batch.allConfirmed ? batch.emails[0]?.confirmed_at : null;
              const deadline = getDeadlineInfo(batch.sent_at, batch.allConfirmed, batchConfirmedAt);

              return (
                <div
                  key={batch.key}
                  className={cn(
                    "rounded-lg border border-border overflow-hidden",
                    isWeekly && batch.allConfirmed && "bg-green-50/50 dark:bg-green-950/10",
                    isWeekly && deadline.isOverdue && "bg-red-50 dark:bg-red-950/20"
                  )}
                >
                  <div
                    className="p-3 cursor-pointer"
                    onClick={() => toggleExpand(batch.key)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-foreground">{batch.assignee_name}</span>
                      <div className="flex items-center gap-2">
                        {isWeekly ? (
                          batch.allConfirmed ? (
                            <Badge className="text-[10px] bg-green-100 text-green-700 border-0 dark:bg-green-900/30 dark:text-green-400">Confirmado</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Pendiente</Badge>
                          )
                        ) : (
                          <Badge className="text-[10px] bg-green-100 text-green-700 border-0 dark:bg-green-900/30 dark:text-green-400">Enviado</Badge>
                        )}
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{batch.assignee_email}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <FileText className="h-2.5 w-2.5" />
                          {batch.topicCount} {batch.topicCount === 1 ? 'tema' : 'temas'}
                        </Badge>
                        {isWeekly && (
                        <span className={cn("font-mono font-medium text-[10px] inline-flex items-center gap-0.5", deadline.color)}>
                          {deadline.isOverdue && <AlertTriangle className="h-2.5 w-2.5" />}
                          {deadline.label}
                        </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(batch.sent_at), "dd MMM yyyy HH:mm", { locale: es })}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border bg-muted/20 p-3 space-y-1.5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Temas</p>
                        <div className="flex items-center gap-2">
                          {isWeekly && (
                          <div onClick={e => e.stopPropagation()}>
                            {batch.allConfirmed ? (
                              <Checkbox
                                checked={true}
                                onCheckedChange={() => {
                                  batchIds.forEach(id => handleUnconfirmEmail(id));
                                }}
                                className="h-4 w-4"
                              />
                            ) : (
                              <ConfirmDatetimePopover
                                emailId={batchIds[0]}
                                sentAt={batch.sent_at}
                                onConfirm={(_, confirmedAt) => {
                                  toggleBatchConfirmed.mutate({ ids: batchIds, confirmed: true, confirmed_at: confirmedAt });
                                }}
                              />
                            )}
                          </div>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteBatch.mutate(batchIds); }}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {batch.emails.map((email, i) => {
                        const emailDeadline = getDeadlineInfo(email.sent_at, email.confirmed, email.confirmed_at);
                        return (
                          <div key={email.id} className="flex items-center justify-between gap-2 py-1 border-b border-border/50 last:border-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] text-muted-foreground shrink-0">{i + 1}.</span>
                              <span className="text-xs text-foreground truncate">{email.topic_title}</span>
                            </div>
                            {isWeekly ? (
                            <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                              {email.confirmed ? (
                                <>
                                  <span className={cn("text-[10px] font-medium", emailDeadline.color)}>
                                    {emailDeadline.label}
                                  </span>
                                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                                  <Checkbox
                                    checked={true}
                                    onCheckedChange={() => handleUnconfirmEmail(email.id)}
                                    className="h-3.5 w-3.5"
                                  />
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <ConfirmDatetimePopover
                                    emailId={email.id}
                                    sentAt={email.sent_at}
                                    onConfirm={handleConfirmEmail}
                                  />
                                </>
                              )}
                            </div>
                            ) : (
                            <span className="text-[10px] text-muted-foreground shrink-0">Informativo</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
