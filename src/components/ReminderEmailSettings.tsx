import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Save, Trash2, X, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useReminderEmails, type ReminderEmail } from '@/hooks/useReminderEmails';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function ReminderEmailSettings() {
  const { reminderEmails, isLoading, upsertReminderEmail, deleteReminderEmail } = useReminderEmails();

  const [editing, setEditing] = useState<Partial<ReminderEmail> | null>(null);
  const [newEmail, setNewEmail] = useState('');

  const handleNew = () => {
    setEditing({
      enabled: true,
      day_of_week: 4,
      send_hour: 9,
      message: 'Estimados, por favor no olvidar enviar los reportes semanales.',
      recipient_emails: [],
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.message?.trim()) {
      toast.error('Escribe un mensaje para el correo');
      return;
    }
    if (!editing.recipient_emails?.length) {
      toast.error('Agrega al menos un correo destinatario');
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

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Ingresa un correo válido');
      return;
    }
    if (editing?.recipient_emails?.includes(email)) {
      toast.error('Ya está agregado');
      return;
    }
    setEditing(prev => prev ? { ...prev, recipient_emails: [...(prev.recipient_emails || []), email] } : prev);
    setNewEmail('');
  };

  const removeEmail = (email: string) => {
    setEditing(prev => prev ? { ...prev, recipient_emails: (prev.recipient_emails || []).filter(e => e !== email) } : prev);
  };

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
            <label className="text-xs text-muted-foreground mb-1 block">Mensaje del correo</label>
            <Textarea
              value={editing.message ?? ''}
              onChange={e => setEditing(p => p ? { ...p, message: e.target.value } : p)}
              rows={3}
              className="text-sm"
              placeholder="Estimados, por favor no olvidar enviar los reportes semanales."
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Destinatarios</label>
            <div className="flex gap-2">
              <Input
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
                placeholder="correo@ejemplo.com"
                className="h-9 text-sm flex-1"
              />
              <Button variant="outline" size="sm" onClick={addEmail} className="h-9">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {(editing.recipient_emails?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {editing.recipient_emails!.map(email => (
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

          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleSave} disabled={upsertReminderEmail.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" /> Guardar
            </Button>
            {editing.id && (
              <Button size="sm" variant="destructive" onClick={() => handleDelete(editing.id!)} disabled={deleteReminderEmail.isPending}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
              </Button>
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
                  <p className="text-sm font-medium truncate max-w-[300px]">{re.message || 'Sin mensaje'}</p>
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
