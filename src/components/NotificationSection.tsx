import { useState } from 'react';
import { Mail, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

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

export function NotificationSection({ topic, assignees }: NotificationSectionProps) {
  const [sending, setSending] = useState(false);
  const { emails, logEmail, toggleResponded } = useNotificationEmails(topic.id);

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
          subtasks: topic.subtasks.map((s) => ({
            title: s.title,
            completed: s.completed,
            due_date: s.due_date,
          })),
        },
      });

      if (error) {
        const message = typeof error.message === 'string' ? error.message : 'Error al enviar';
        throw new Error(message);
      }

      if (!data?.success) {
        throw new Error('No se pudo enviar el correo');
      }

      await logEmail.mutateAsync({
        topic_id: topic.id,
        assignee_name: assignee.name,
        assignee_email: assignee.email,
      });

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
          onClick={handleSendEmail}
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
      </div>

      {!hasEmail && topic.assignee && (
        <p className="text-[10px] text-muted-foreground italic">
          ⚠️ "{topic.assignee}" no tiene correo configurado. Ve a Configuración para agregarlo.
        </p>
      )}

      {emails.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Correos enviados</p>
          {emails.map((email) => (
            <div
              key={email.id}
              className={cn(
                "flex items-center gap-2 text-[11px] py-1 px-1.5 rounded transition-colors",
                email.responded ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "bg-muted/30 text-muted-foreground"
              )}
            >
              <Checkbox
                checked={email.responded}
                onCheckedChange={(checked) => toggleResponded.mutate({ id: email.id, responded: !!checked })}
                className="h-3.5 w-3.5 shrink-0"
              />
              <span className={cn("truncate", email.responded && "line-through opacity-70")}>
                {email.assignee_name} ({email.assignee_email})
              </span>
              {email.responded && email.responded_at && (
                <span className="text-[9px] shrink-0 flex items-center gap-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {format(new Date(email.responded_at), "dd MMM", { locale: es })}
                </span>
              )}
              <span className="text-[10px] ml-auto shrink-0 font-mono">
                {format(new Date(email.sent_at), "dd MMM yy HH:mm", { locale: es })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
