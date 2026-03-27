import { useState } from 'react';
import { Mail, Send, Loader2, CheckCircle2, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { supabase } from '@/integrations/supabase/client';
import { useNotificationEmails } from '@/hooks/useNotificationEmails';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import type { Assignee } from '@/hooks/useAssignees';

interface NotificationSectionProps {
  topic: TopicWithSubtasks;
  assignees: Assignee[];
}

const DEADLINE_HOURS = 48;

function isOnTime(sentAt: string, confirmedAt: string) {
  const deadlineTime = new Date(sentAt).getTime() + DEADLINE_HOURS * 60 * 60 * 1000;
  return new Date(confirmedAt).getTime() <= deadlineTime;
}

function toLocalDatetime(isoStr: string) {
  const d = new Date(isoStr);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function ConfirmPopover({
  onConfirm,
}: {
  onConfirm: (confirmedAt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(toLocalDatetime(new Date().toISOString()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Checkbox
          checked={false}
          onCheckedChange={() => setOpen(true)}
          className="h-3.5 w-3.5 shrink-0"
          title="Confirmar que respondió"
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
              onConfirm(new Date(value).toISOString());
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

export function NotificationSection({ topic, assignees }: NotificationSectionProps) {
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { emails, logEmail, toggleConfirmed, toggleReviewed, deleteEmail } = useNotificationEmails(topic.id);

  const assignee = assignees.find(a => a.name === topic.assignee);
  const hasEmail = assignee?.email;

  const handleSendEmail = async () => {
    if (!assignee || !assignee.email) {
      toast.error('El responsable no tiene correo configurado. Agrégalo en Configuración.');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          to_email: assignee.email,
          to_name: assignee.name,
          topic_title: topic.title,
          start_date: topic.start_date,
          due_date: topic.due_date,
          subtasks: topic.subtasks.map((s) => ({
            title: s.title,
            completed: s.completed,
            due_date: s.due_date,
            notes: s.notes || null,
          })),
          progress_entries: topic.progress_entries
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5)
            .map((e) => ({ content: e.content, created_at: e.created_at })),
        },
      });

      if (error) {
        let message = typeof error.message === 'string' ? error.message : 'Error al enviar';
        const response = (error as { context?: Response }).context;

        if (response instanceof Response) {
          try {
            const payload = await response.json();
            if (payload?.error || payload?.message) {
              message = payload.error || payload.message;
            }
          } catch {
            try {
              const text = await response.text();
              if (text) message = text;
            } catch {
              // ignore parsing fallback errors
            }
          }
        }

        throw new Error(message);
      }

      if (!data?.success) {
        throw new Error('No se pudo enviar el correo');
      }

      try {
        await logEmail.mutateAsync({
          topic_id: topic.id,
          assignee_name: assignee.name,
          assignee_email: assignee.email,
        });
      } catch (logError) {
        console.error('Email sent but failed to log:', logError);
        toast.warning(`Correo enviado a ${assignee.name}, pero no se pudo registrar en el historial`);
        return;
      }

      toast.success(`Correo enviado a ${assignee.name}`);
    } catch (error: any) {
      console.error('Send email error:', error);
      toast.error(error.message || 'Error al enviar el correo');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Mail className="h-3 w-3" />
          Notificación
        </label>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "h-7 text-xs gap-1.5",
            hasEmail && "hover:bg-primary hover:text-primary-foreground"
          )}
          onClick={() => setConfirmOpen(true)}
          disabled={sending || !hasEmail}
          title={!hasEmail ? 'Agrega un correo al responsable en Configuración' : `Enviar recordatorio a ${assignee?.email}`}
        >
          {sending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
          {sending ? 'Enviando...' : 'Enviar recordatorio'}
        </Button>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Enviar recordatorio?</AlertDialogTitle>
              <AlertDialogDescription>
                Se enviará un correo de recordatorio a <strong>{assignee?.name}</strong> ({assignee?.email}) sobre el tema "<strong>{topic.title}</strong>".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setConfirmOpen(false); handleSendEmail(); }}>
                Sí, enviar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {!hasEmail && topic.assignee && (
        <p className="text-[10px] text-muted-foreground italic">
          ⚠️ "{topic.assignee}" no tiene correo configurado. Ve a Configuración para agregarlo.
        </p>
      )}

      {emails.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Correos enviados</p>
          {emails.map((email) => {
            const isNewTopic = (email as any).email_type === 'new_topic';
            const onTime = !isNewTopic && email.confirmed && email.confirmed_at ? isOnTime(email.sent_at, email.confirmed_at) : null;
            return (
              <div
                key={email.id}
                className={cn(
                  "flex items-center gap-2 text-[11px] py-1 px-1.5 rounded transition-colors",
                  !isNewTopic && email.confirmed ? "bg-green-50 dark:bg-green-950/30" : "bg-muted/30"
                )}
              >
                {isNewTopic ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                ) : email.confirmed ? (
                  <Checkbox
                    checked={true}
                    onCheckedChange={() => toggleConfirmed.mutate({ id: email.id, confirmed: false })}
                    className="h-3.5 w-3.5 shrink-0"
                    title="Desmarcar confirmación"
                  />
                ) : (
                  <ConfirmPopover
                    onConfirm={(confirmedAt) => toggleConfirmed.mutate({ id: email.id, confirmed: true, confirmed_at: confirmedAt })}
                  />
                )}
                <span className={cn("truncate", !isNewTopic && email.confirmed && "line-through opacity-70")}>
                  {email.assignee_name}
                </span>
                {isNewTopic ? (
                  <span className="text-[9px] shrink-0 flex items-center gap-0.5 text-muted-foreground">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Notificado
                  </span>
                ) : email.confirmed ? (
                  <span className={cn(
                    "text-[9px] shrink-0 flex items-center gap-0.5",
                    onTime === true ? "text-green-600 dark:text-green-400" : "text-destructive"
                  )}>
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {onTime ? 'A tiempo' : 'Fuera de plazo'}
                    {email.confirmed_at && ` · ${format(new Date(email.confirmed_at), "dd MMM", { locale: es })}`}
                  </span>
                ) : (
                  <span className="text-[9px] shrink-0 flex items-center gap-0.5 text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    Pendiente
                  </span>
                )}
                <span className="text-[10px] ml-auto shrink-0 font-mono">
                  {format(new Date(email.sent_at), "dd MMM yy HH:mm", { locale: es })}
                </span>
                <button
                  onClick={() => deleteEmail.mutate(email.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  title="Eliminar registro"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
