import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Clock, Mail, Save, Plus, Trash2, Users, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useEmailSchedules, type EmailSchedule } from '@/hooks/useEmailSchedules';
import type { Assignee } from '@/hooks/useAssignees';

interface TopicBasic {
  id: string;
  title: string;
  assignee: string | null;
  status: string;
}

interface EmailScheduleSettingsProps {
  assignees: Assignee[];
  topics: TopicBasic[];
}

const DAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function EmailScheduleSettings({ assignees, topics }: EmailScheduleSettingsProps) {
  const { schedules, isLoading, upsertSchedule, deleteSchedule } = useEmailSchedules();
  const [editingSchedule, setEditingSchedule] = useState<Partial<EmailSchedule> | null>(null);

  const seguimientoTopics = useMemo(
    () => topics.filter((t) => t.status === 'seguimiento'),
    [topics]
  );

  const assigneesWithEmail = useMemo(
    () => assignees.filter((a) => a.email),
    [assignees]
  );

  useEffect(() => {
    if (!isLoading && schedules.length > 0 && !editingSchedule) {
      setEditingSchedule({ ...schedules[0] });
    }
  }, [isLoading, schedules]);

  const handleNew = () => {
    setEditingSchedule({
      enabled: false,
      day_of_week: 1,
      send_hour: 9,
      send_minute: 0,
      send_to_all_assignees: true,
      selected_assignee_ids: [],
      send_all_topics: true,
      selected_topic_ids: [],
    });
  };

  const handleSave = async () => {
    if (!editingSchedule) return;
    try {
      await upsertSchedule.mutateAsync(editingSchedule);
      toast.success('Configuración guardada');
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSchedule.mutateAsync(id);
      setEditingSchedule(null);
      toast.success('Configuración eliminada');
    } catch (e: any) {
      toast.error(e.message || 'Error al eliminar');
    }
  };

  const toggleAssignee = (assigneeId: string) => {
    if (!editingSchedule) return;
    const current = editingSchedule.selected_assignee_ids || [];
    const updated = current.includes(assigneeId)
      ? current.filter((id) => id !== assigneeId)
      : [...current, assigneeId];
    setEditingSchedule({ ...editingSchedule, selected_assignee_ids: updated });
  };

  const toggleTopic = (topicId: string) => {
    if (!editingSchedule) return;
    const current = editingSchedule.selected_topic_ids || [];
    const updated = current.includes(topicId)
      ? current.filter((id) => id !== topicId)
      : [...current, topicId];
    setEditingSchedule({ ...editingSchedule, selected_topic_ids: updated });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">Cargando configuración...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Correos Automáticos
          </CardTitle>
          {!editingSchedule && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleNew}>
              <Plus className="h-3 w-3" /> Nueva programación
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!editingSchedule && schedules.length === 0 && (
          <div className="text-center py-6">
            <Mail className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No hay correos programados.</p>
            <Button size="sm" className="mt-3 text-xs gap-1" onClick={handleNew}>
              <Plus className="h-3 w-3" /> Crear programación
            </Button>
          </div>
        )}

        {editingSchedule && (
          <div className="space-y-5">
            {/* Enabled toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Activar envío automático</Label>
                <p className="text-xs text-muted-foreground">Los correos se enviarán según la programación</p>
              </div>
              <Switch
                checked={editingSchedule.enabled ?? false}
                onCheckedChange={(checked) => setEditingSchedule({ ...editingSchedule, enabled: checked })}
              />
            </div>

            {/* Schedule: Day + Time */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Programación
              </Label>
              <div className="flex gap-2 flex-wrap">
                <Select
                  value={String(editingSchedule.day_of_week ?? 1)}
                  onValueChange={(v) => setEditingSchedule({ ...editingSchedule, day_of_week: Number(v) })}
                >
                  <SelectTrigger className="w-[140px] h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(editingSchedule.send_hour ?? 9)}
                  onValueChange={(v) => setEditingSchedule({ ...editingSchedule, send_hour: Number(v) })}
                >
                  <SelectTrigger className="w-[90px] h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground self-center">hrs (Chile)</span>
              </div>
            </div>

            {/* Assignees */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Destinatarios
              </Label>
              <div className="flex items-center gap-2 mb-2">
                <Switch
                  checked={editingSchedule.send_to_all_assignees ?? true}
                  onCheckedChange={(checked) => setEditingSchedule({ ...editingSchedule, send_to_all_assignees: checked, selected_assignee_ids: [] })}
                />
                <span className="text-sm">
                  {editingSchedule.send_to_all_assignees ? 'Enviar a todos los responsables con correo' : 'Seleccionar responsables'}
                </span>
              </div>
              {!editingSchedule.send_to_all_assignees && (
                <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                  {assigneesWithEmail.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">No hay responsables con correo configurado.</p>
                  ) : (
                    assigneesWithEmail.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={(editingSchedule.selected_assignee_ids || []).includes(a.id)}
                          onCheckedChange={() => toggleAssignee(a.id)}
                        />
                        <span className="text-sm">{a.name}</span>
                        <span className="text-xs text-muted-foreground">{a.email}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Topics */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Temas en Seguimiento
              </Label>
              <div className="flex items-center gap-2 mb-2">
                <Switch
                  checked={editingSchedule.send_all_topics ?? true}
                  onCheckedChange={(checked) => setEditingSchedule({ ...editingSchedule, send_all_topics: checked, selected_topic_ids: [] })}
                />
                <span className="text-sm">
                  {editingSchedule.send_all_topics ? 'Incluir todos los temas en seguimiento' : 'Seleccionar temas específicos'}
                </span>
              </div>
              {!editingSchedule.send_all_topics && (
                <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
                  {seguimientoTopics.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">No hay temas en seguimiento.</p>
                  ) : (
                    seguimientoTopics.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={(editingSchedule.selected_topic_ids || []).includes(t.id)}
                          onCheckedChange={() => toggleTopic(t.id)}
                        />
                        <span className="text-sm flex-1 truncate">{t.title}</span>
                        {t.assignee && (
                          <Badge variant="outline" className="text-[10px] shrink-0">{t.assignee}</Badge>
                        )}
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Summary */}
            {editingSchedule.enabled && (
              <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground text-sm">📅 Resumen</p>
                <p>
                  Cada <strong>{DAYS.find((d) => d.value === editingSchedule.day_of_week)?.label}</strong> a las{' '}
                  <strong>{String(editingSchedule.send_hour ?? 9).padStart(2, '0')}:00</strong>
                </p>
                <p>
                  A: {editingSchedule.send_to_all_assignees
                    ? `Todos los responsables con correo (${assigneesWithEmail.length})`
                    : `${(editingSchedule.selected_assignee_ids || []).length} responsable(s) seleccionado(s)`}
                </p>
                <p>
                  Temas: {editingSchedule.send_all_topics
                    ? `Todos en seguimiento (${seguimientoTopics.length})`
                    : `${(editingSchedule.selected_topic_ids || []).length} tema(s) seleccionado(s)`}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button size="sm" className="h-8 text-xs gap-1" onClick={handleSave} disabled={upsertSchedule.isPending}>
                <Save className="h-3 w-3" />
                {upsertSchedule.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
              {editingSchedule.id && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 text-xs gap-1"
                  onClick={() => handleDelete(editingSchedule.id!)}
                  disabled={deleteSchedule.isPending}
                >
                  <Trash2 className="h-3 w-3" /> Eliminar
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => setEditingSchedule(schedules.length > 0 ? { ...schedules[0] } : null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {!editingSchedule && schedules.length > 0 && (
          <div className="space-y-2">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-md border cursor-pointer hover:bg-muted/50"
                onClick={() => setEditingSchedule({ ...s })}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${s.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                  <div>
                    <p className="text-sm font-medium">
                      {DAYS.find((d) => d.value === s.day_of_week)?.label} a las {String(s.send_hour).padStart(2, '0')}:00
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.send_to_all_assignees ? 'Todos los responsables' : `${s.selected_assignee_ids.length} seleccionados`}
                      {' · '}
                      {s.send_all_topics ? 'Todos los temas' : `${s.selected_topic_ids.length} temas`}
                    </p>
                  </div>
                </div>
                <Badge variant={s.enabled ? 'default' : 'secondary'} className="text-[10px]">
                  {s.enabled ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
