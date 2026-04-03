import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Save, Trash2, X, Mail, UserPlus, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useReminderEmails, type ReminderEmail } from '@/hooks/useReminderEmails';
import type { Assignee } from '@/hooks/useAssignees';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface ReminderEmailSettingsProps {
  assignees: Assignee[];
}

export function ReminderEmailSettings({ assignees }: ReminderEmailSettingsProps) {
  const { reminderEmails, isLoading, upsertReminderEmail, deleteReminderEmail } = useReminderEmails();

  const [editing, setEditing] = useState<Partial<ReminderEmail> | null>(null);
  const [customEmail, setCustomEmail] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [sendingTest, setSendingTest] = useState<string | null>(null);

  const handleTestSend = async (id: string) => {
    setSendingTest(id);
    try {
      const { data, error } = await supabase.functions.invoke('send-reminder-email', {
        body: { test: true, reminder_id: id },
      });
      if (error) throw error;
      toast.success(`Correo de prueba enviado (${data?.emails_sent || 0} destinatarios)`);
    } catch (e: any) {
      toast.error('Error al enviar prueba: ' + (e.message || e));
    } finally {
      setSendingTest(null);
    }
  };

  const assigneesWithEmail = assignees.filter(a => a.email);

  const handleNew = () => {
    setEditing({
      enabled: true,
      day_of_week: 4,
      send_hour: 9,
      subject: 'Recordatorio semanal',
      message: 'Estimados, por favor no olvidar enviar los reportes semanales.',
      recipient_emails: [],
    });
    setShowCustomInput(false);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.subject?.trim()) {
      toast.error('Escribe un asunto para el correo');
      return;
    }
    if (!editing.message?.trim()) {
      toast.error('Escribe un mensaje para el correo');
      return;
    }
    if (!editing.recipient_emails?.length) {
      toast.error('Selecciona al menos un destinatario');
      return;
    }
    try {
      await upsertReminderEmail.mutateAsync(editing);
      toast.success(editing.id ? 'Recordatorio actualizado' : 'Recordatorio creado');
      setEditing(null);
    } catch {
      toast.error('Error al guardar');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReminderEmail.mutateAsync(id);
      toast.success('Recordatorio eliminado');
      setEditing(null);
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const toggleAssigneeEmail = (email: string) => {
    setEditing(prev => {
      if (!prev) return prev;
      const emails = prev.recipient_emails || [];
      const has = emails.includes(email);
      return { ...prev, recipient_emails: has ? emails.filter(e => e !== email) : [...emails, email] };
    });
  };

  const addCustomEmail = () => {
    const email = customEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Ingresa un correo válido');
      return;
    }
    if (editing?.recipient_emails?.includes(email)) {
      toast.error('Ya está agregado');
      return;
    }
    setEditing(prev => prev ? { ...prev, recipient_emails: [...(prev.recipient_emails || []), email] } : prev);
    setCustomEmail('');
  };

  const removeEmail = (email: string) => {
    setEditing(prev => prev ? { ...prev, recipient_emails: (prev.recipient_emails || []).filter(e => e !== email) } : prev);
  };

  // Emails that are custom (not from assignees)
  const assigneeEmails = new Set(assigneesWithEmail.map(a => a.email!.toLowerCase()));
  const customEmails = (editing?.recipient_emails || []).filter(e => !assigneeEmails.has(e.toLowerCase()));

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  if (editing) {
    return (
      <Card>
        <CardContent className="pt-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {editing.id ? 'Editar recordatorio' : 'Nuevo recordatorio por correo'}
          </h3>

          <div className="flex items-center gap-3">
            <Switch checked={editing.enabled ?? false} onCheckedChange={v => setEditing(p => p ? { ...p, enabled: v } : p)} />
            <span className="text-sm">{editing.enabled ? 'Activo' : 'Inactivo'}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Día</label>
              <Select value={String(editing.day_of_week)} onValueChange={v => setEditing(p => p ? { ...p, day_of_week: Number(v) } : p)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Hora</label>
              <Select value={String(editing.send_hour)} onValueChange={v => setEditing(p => p ? { ...p, send_hour: Number(v) } : p)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.map(h => <SelectItem key={h} value={String(h)}>{`${h.toString().padStart(2, '0')}:00`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Asunto del correo</label>
            <Input
              value={editing.subject ?? ''}
              onChange={e => setEditing(p => p ? { ...p, subject: e.target.value } : p)}
              className="h-9 text-sm"
              placeholder="Recordatorio semanal"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Mensaje del correo</label>
            <Textarea
              value={editing.message ?? ''}
              onChange={e => setEditing(p => p ? { ...p, message: e.target.value } : p)}
              rows={3}
              className="text-sm"
              placeholder="Estimados, por favor no olvidar enviar los reportes semanales."
            />
          </div>

          {/* Assignee selection */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Destinatarios (responsables registrados)</label>
            {assigneesWithEmail.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No hay responsables con correo registrado.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded-md p-2">
                {assigneesWithEmail.map(a => {
                  const checked = editing.recipient_emails?.includes(a.email!) ?? false;
                  return (
                    <label key={a.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1">
                      <Checkbox checked={checked} onCheckedChange={() => toggleAssigneeEmail(a.email!)} />
                      <span className="text-sm">{a.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{a.email}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom emails */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">Correos adicionales</label>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setShowCustomInput(!showCustomInput)}>
                <UserPlus className="h-3 w-3" /> Agregar otro
              </Button>
            </div>
            {showCustomInput && (
              <div className="flex gap-2 mb-2">
                <Input
                  value={customEmail}
                  onChange={e => setCustomEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomEmail(); } }}
                  placeholder="correo@ejemplo.com"
                  className="h-8 text-sm flex-1"
                />
                <Button variant="outline" size="sm" onClick={addCustomEmail} className="h-8">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {customEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {customEmails.map(email => (
                  <Badge key={email} variant="secondary" className="text-xs gap-1 pr-1">
                    {email}
                    <button onClick={() => removeEmail(email)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {(editing.recipient_emails?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
              📧 Se enviará a <strong>{editing.recipient_emails!.length}</strong> destinatario{editing.recipient_emails!.length !== 1 ? 's' : ''} los <strong>{DAYS[editing.day_of_week ?? 4]}</strong> a las <strong>{(editing.send_hour ?? 9).toString().padStart(2, '0')}:00</strong>
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleSave} disabled={upsertReminderEmail.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" /> Guardar
            </Button>
            {editing.id && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTestSend(editing.id!)}
                  disabled={sendingTest === editing.id || !editing.recipient_emails?.length}
                >
                  {sendingTest === editing.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                  Enviar prueba
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(editing.id!)} disabled={deleteReminderEmail.isPending}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Correos recordatorio
          </h3>
          <Button variant="outline" size="sm" onClick={handleNew}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nuevo
          </Button>
        </div>

        {reminderEmails.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No hay correos recordatorio configurados. Crea uno para enviar mensajes automáticos.
          </p>
        ) : (
          <div className="space-y-2">
            {reminderEmails.map(re => (
              <div
                key={re.id}
                className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setEditing(re)}
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium truncate max-w-[300px]">{re.subject || re.message || 'Sin mensaje'}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {DAYS[re.day_of_week]} a las {re.send_hour.toString().padStart(2, '0')}:00 · {re.recipient_emails.length} destinatario{re.recipient_emails.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Badge variant={re.enabled ? 'default' : 'secondary'} className="text-[10px]">
                  {re.enabled ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
