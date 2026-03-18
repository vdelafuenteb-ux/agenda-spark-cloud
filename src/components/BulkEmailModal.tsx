import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNotificationEmails } from '@/hooks/useNotificationEmails';
import { toast } from 'sonner';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import type { Assignee } from '@/hooks/useAssignees';

interface BulkEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topics: TopicWithSubtasks[];
  assignee: Assignee;
}

export function BulkEmailModal({ open, onOpenChange, topics, assignee }: BulkEmailModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(topics.map(t => t.id)));
  const [sending, setSending] = useState(false);
  const { logEmail } = useNotificationEmails();

  // Sync selections when modal opens or topics change
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(topics.map(t => t.id)));
    }
  }, [open, topics]);

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(topics.map(t => t.id)));
    }
  };

  const toggleTopic = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (!assignee.email) {
      toast.error('El responsable no tiene email configurado');
      return;
    }

    const selected = topics.filter(t => selectedIds.has(t.id));
    if (selected.length === 0) {
      toast.error('Selecciona al menos un tema');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-bulk-notification', {
        body: {
          to_email: assignee.email,
          to_name: assignee.name,
          topics: selected.map(t => ({
            title: t.title,
            subtasks: t.subtasks.map(s => ({
              title: s.title,
              completed: s.completed,
              due_date: s.due_date,
            })),
          })),
        },
      });

      if (error) throw error;

      // Log one entry per topic
      await Promise.all(
        selected.map(t =>
          logEmail.mutateAsync({
            topic_id: t.id,
            assignee_name: assignee.name,
            assignee_email: assignee.email!,
          })
        )
      );

      toast.success(`Correo enviado con ${selected.length} tema${selected.length > 1 ? 's' : ''}`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar correo masivo');
    } finally {
      setSending(false);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Envío masivo a {assignee.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {assignee.email || 'Sin email configurado'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedCount} de {topics.length} temas seleccionados
            </span>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={toggleAll}>
              {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </Button>
          </div>

          <div className="max-h-64 overflow-auto space-y-1 border rounded-md p-2">
            {topics.map(topic => {
              const pending = topic.subtasks.filter(s => !s.completed).length;
              return (
                <label
                  key={topic.id}
                  className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedIds.has(topic.id)}
                    onCheckedChange={() => toggleTopic(topic.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{topic.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {pending} subtarea{pending !== 1 ? 's' : ''} pendiente{pending !== 1 ? 's' : ''}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || selectedCount === 0 || !assignee.email}
            className="gap-1"
          >
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
            Enviar correo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
