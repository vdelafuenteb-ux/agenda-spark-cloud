import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Plus, X, User, ChevronsUpDown, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toStoredDate } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { Tag as TagType } from '@/hooks/useTags';
import type { Assignee } from '@/hooks/useAssignees';
import type { Department } from '@/hooks/useDepartments';
import type { Database } from '@/integrations/supabase/types';
import { useProjects } from '@/features/workGraph/useProjects';
import { useClients } from '@/features/workGraph/useClients';
import type { WorkEdgeType, WorkNodeType } from '@/features/workGraph/types';
import { EDGE_LABELS } from '@/features/workGraph/types';

// Draft of a manual relationship the user declares during task creation.
// Persisted into `task_relationships` after the task is inserted so the edge
// can reference the real task id.
export interface PendingRelationship {
  edge_type: WorkEdgeType;
  target_type: WorkNodeType;
  target_id: string;
  target_label: string;   // cached for UI chips
  reason?: string;
}

// Which (edge → target type) combinations are offered in the modal. Kept
// tight so the UX stays crisp.
const RELATIONSHIP_SLOTS: Array<{
  key: string;
  edge_type: WorkEdgeType;
  target_type: WorkNodeType;
  label: string;
  helper: string;
}> = [
  { key: 'depends_task', edge_type: 'DEPENDS_ON', target_type: 'task', label: 'Depende de tarea', helper: 'Otra tarea que debe completarse primero' },
  { key: 'depends_user', edge_type: 'WAITING_FOR', target_type: 'user', label: 'Espera a persona', helper: 'Necesita input de alguien específico' },
  { key: 'depends_area', edge_type: 'BLOCKED_BY', target_type: 'area', label: 'Bloqueado por área', helper: 'Área cuya entrega frena esta tarea' },
  { key: 'approved_by', edge_type: 'APPROVED_BY', target_type: 'user', label: 'Requiere aprobación', helper: 'Persona que debe aprobar' },
  { key: 'impacts_proj', edge_type: 'IMPACTS_PROJECT', target_type: 'project', label: 'Impacta proyecto', helper: 'Proyecto donde pesa el resultado' },
  { key: 'impacts_client', edge_type: 'IMPACTS', target_type: 'client', label: 'Impacta cliente', helper: 'Cliente afectado por esta tarea' },
];

type Priority = Database['public']['Enums']['topic_priority'];
type Status = Database['public']['Enums']['topic_status'];

const TAG_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6b7280'];

interface CreateTopicModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allTags: TagType[];
  assignees: Assignee[];
  departments: Department[];
  topics?: Array<{ id: string; title: string }>;
  onCreateAssignee: (data: { name: string; email?: string; department_id?: string }) => Promise<Assignee>;
  onSubmit: (data: {
    title: string;
    priority: Priority;
    status: Status;
    start_date: string | null;
    due_date: string | null;
    is_ongoing: boolean;
    subtasks: string[];
    tagIds: string[];
    newTags: { name: string; color: string }[];
    notes: string;
    assignee?: string;
    department_id?: string;
    execution_order?: number | null;
    hh_type?: string | null;
    hh_value?: number | null;
    project_id?: string | null;
    client_id?: string | null;
    relationships?: PendingRelationship[];
  }) => Promise<void> | void;
  isPending: boolean;
}

export function CreateTopicModal({ open, onOpenChange, allTags, assignees, departments, topics = [], onCreateAssignee, onSubmit, isPending }: CreateTopicModalProps) {
  const { projects } = useProjects();
  const { clients } = useClients();
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [clientId, setClientId] = useState('');
  const [pendingRelationships, setPendingRelationships] = useState<PendingRelationship[]>([]);
  const [relSlotOpen, setRelSlotOpen] = useState(false);
  const [relSlotKey, setRelSlotKey] = useState<string>('depends_task');
  const [relTargetId, setRelTargetId] = useState<string>('');
  const [relReason, setRelReason] = useState('');
  const [priority, setPriority] = useState<Priority>('media');
  const [status, setStatus] = useState<Status>('activo');
  const [assignee, setAssignee] = useState('');
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [showNewAssigneeForm, setShowNewAssigneeForm] = useState(false);
  const [newAssigneeName, setNewAssigneeName] = useState('');
  const [newAssigneeEmail, setNewAssigneeEmail] = useState('');
  const [newAssigneeDeptId, setNewAssigneeDeptId] = useState('');
  const [dueDate, setDueDate] = useState<Date>();
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [pendingNewTags, setPendingNewTags] = useState<{ name: string; color: string }[]>([]);
  const [notes, setNotes] = useState('');
  const [isOngoing, setIsOngoing] = useState(false);
  const [executionOrder, setExecutionOrder] = useState<number | null>(null);
  const [hhType, setHhType] = useState<string | null>(null);
  const [hhValue, setHhValue] = useState<number | null>(null);

  const reset = () => {
    setTitle('');
    setPriority('media');
    setStatus('activo');
    setAssignee('');
    setDepartmentId('');
    setProjectId('');
    setClientId('');
    setPendingRelationships([]);
    setRelSlotOpen(false);
    setRelSlotKey('depends_task');
    setRelTargetId('');
    setRelReason('');
    setShowNewAssigneeForm(false);
    setNewAssigneeName('');
    setNewAssigneeEmail('');
    setNewAssigneeDeptId('');
    setDueDate(undefined);
    setStartDate(new Date());
    setSubtasks([]);
    setNewSubtask('');
    setSelectedTagIds([]);
    setPendingNewTags([]);
    setNewTagName('');
    setNewTagColor(TAG_COLORS[0]);
    setNotes('');
    setIsOngoing(false);
    setExecutionOrder(null);
    setHhType(null);
    setHhValue(null);
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks((prev) => [...prev, newSubtask.trim()]);
    setNewSubtask('');
  };

  const handleCreateNewTag = () => {
    if (!newTagName.trim()) return;
    setPendingNewTags((prev) => [...prev, { name: newTagName.trim(), color: newTagColor }]);
    setNewTagName('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (status === 'seguimiento' && !assignee.trim()) return;
    await onSubmit({
      title: title.trim(),
      priority,
      status,
      start_date: toStoredDate(startDate),
      due_date: isOngoing ? null : toStoredDate(dueDate),
      is_ongoing: isOngoing,
      subtasks,
      tagIds: selectedTagIds,
      newTags: pendingNewTags,
      notes,
      assignee: assignee.trim() || undefined,
      department_id: departmentId && departmentId !== 'none' ? departmentId : undefined,
      execution_order: executionOrder,
      hh_type: hhType,
      hh_value: hhValue,
      project_id: projectId && projectId !== 'none' ? projectId : null,
      client_id: clientId && clientId !== 'none' ? clientId : null,
      relationships: pendingRelationships,
    });
    reset();
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const handleSelectAssignee = (a: Assignee) => {
    setAssignee(a.name);
    if (a.department_id) {
      setDepartmentId(a.department_id);
    }
    setAssigneePopoverOpen(false);
  };

  const handleCreateNewAssignee = async () => {
    if (!newAssigneeName.trim()) return;
    const created = await onCreateAssignee({
      name: newAssigneeName.trim(),
      email: newAssigneeEmail.trim() || undefined,
      department_id: newAssigneeDeptId && newAssigneeDeptId !== 'none' ? newAssigneeDeptId : undefined,
    });
    setAssignee(created.name);
    if (created.department_id) {
      setDepartmentId(created.department_id);
    }
    setNewAssigneeName('');
    setNewAssigneeEmail('');
    setNewAssigneeDeptId('');
    setShowNewAssigneeForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) reset(); onOpenChange(value); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Tema</DialogTitle>
          <DialogDescription>Configura todos los detalles del tema antes de crearlo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Título</label>
            <Input placeholder="Nombre del tema..." value={title} onChange={(event) => setTitle(event.target.value)} className="h-9 text-sm" autoFocus />
          </div>

          {/* Responsable — dropdown con buscador */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Responsable {status === 'seguimiento' ? '*' : ''}</label>
            <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={assigneePopoverOpen}
                  className="w-full justify-between h-9 text-sm font-normal"
                >
                  {assignee ? (
                    <span className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {assignee}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Seleccionar responsable...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar responsable..." />
                  <CommandList>
                    <CommandEmpty>No se encontró responsable.</CommandEmpty>
                    <CommandGroup>
                      {assignees.map((a) => {
                        const dept = departments.find((d) => d.id === a.department_id);
                        return (
                          <CommandItem
                            key={a.id}
                            value={a.name}
                            onSelect={() => handleSelectAssignee(a)}
                          >
                            <Check className={cn("mr-2 h-3.5 w-3.5", assignee === a.name ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1">{a.name}</span>
                            {dept && <span className="text-[10px] text-muted-foreground ml-2">{dept.name}</span>}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => { setShowNewAssigneeForm(true); setAssigneePopoverOpen(false); }}
                        className="text-primary"
                      >
                        <Plus className="mr-2 h-3.5 w-3.5" />
                        Crear nuevo responsable
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Mini-formulario para crear responsable */}
            {showNewAssigneeForm && (
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 mt-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nuevo responsable</p>
                <Input
                  placeholder="Nombre *"
                  value={newAssigneeName}
                  onChange={(e) => setNewAssigneeName(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Input
                  placeholder="Email (opcional)"
                  type="email"
                  value={newAssigneeEmail}
                  onChange={(e) => setNewAssigneeEmail(e.target.value)}
                  className="h-8 text-sm"
                />
                <Select value={newAssigneeDeptId || 'none'} onValueChange={setNewAssigneeDeptId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Departamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin departamento</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs flex-1" disabled={!newAssigneeName.trim()} onClick={handleCreateNewAssignee}>
                    <Plus className="h-3 w-3 mr-1" /> Crear
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowNewAssigneeForm(false); setNewAssigneeName(''); setNewAssigneeEmail(''); setNewAssigneeDeptId(''); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Row: Prioridad + Estado + Departamento + Orden */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Orden</label>
              <Input
                type="number"
                min={1}
                placeholder="—"
                value={executionOrder ?? ''}
                onChange={(e) => setExecutionOrder(e.target.value ? parseInt(e.target.value) : null)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prioridad</label>
              <Select value={priority} onValueChange={(value: Priority) => setPriority(value)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</label>
              <Select value={status} onValueChange={(value: Status) => setStatus(value)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="seguimiento">Seguimiento</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Departamento</label>
              <Select value={departmentId || 'none'} onValueChange={setDepartmentId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin depto." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin departamento</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row: Proyecto + Cliente (globales, cross-workspace) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Proyecto</label>
              <Select value={projectId || 'none'} onValueChange={setProjectId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin proyecto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proyecto</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</label>
              <Select value={clientId || 'none'} onValueChange={setClientId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cliente</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row: Fechas + Continuo */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha inicio</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-full justify-start font-normal">
                    <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                    {startDate ? format(startDate, 'dd MMM yyyy', { locale: es }) : 'Hoy'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha cierre</label>
              {isOngoing ? (
                <div className="h-8 flex items-center text-xs text-muted-foreground italic px-2">Sin fecha (continuo)</div>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-full justify-start font-normal">
                      <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                      {dueDate ? format(dueDate, 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {/* Continuo toggle + HH */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-border bg-muted/30 flex-1 min-w-[200px]">
              <Switch id="is-ongoing" checked={isOngoing} onCheckedChange={(v) => { setIsOngoing(v); if (v) setDueDate(undefined); }} />
              <Label htmlFor="is-ongoing" className="text-xs font-medium cursor-pointer">Continuo (sin fecha fin)</Label>
            </div>
          </div>

          {/* Horas Hombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Horas Hombre (HH)</label>
            <div className="flex items-center gap-2">
              <Select value={hhType || 'none'} onValueChange={(v) => setHhType(v === 'none' ? null : v)}>
                <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin HH</SelectItem>
                  <SelectItem value="diaria">Diaria</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="total">Total</SelectItem>
                </SelectContent>
              </Select>
              {hhType && (
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="Horas"
                  value={hhValue ?? ''}
                  onChange={(e) => setHhValue(e.target.value ? parseFloat(e.target.value) : null)}
                  className="h-8 text-xs w-20"
                />
              )}
              {hhType && hhValue && (
                <span className="text-[10px] text-muted-foreground">
                  {hhType === 'diaria' ? `≈ ${(hhValue * 5).toFixed(1)}h/sem` : hhType === 'semanal' ? `${hhValue}h/sem` : `${hhValue}h total`}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Etiquetas</label>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all"
                    style={{
                      backgroundColor: isSelected ? tag.color : 'transparent',
                      color: isSelected ? '#fff' : tag.color,
                      border: `1.5px solid ${tag.color}`,
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
              {pendingNewTags.map((tag, index) => (
                <Badge key={`new-${index}`} className="text-[10px] px-2 py-0.5 gap-1 border-transparent text-white" style={{ backgroundColor: tag.color }}>
                  {tag.name}
                  <button type="button" onClick={() => setPendingNewTags((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Input placeholder="Nueva etiqueta..." value={newTagName} onChange={(event) => setNewTagName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleCreateNewTag()} className="h-7 text-xs flex-1" />
              <div className="flex gap-0.5">
                {TAG_COLORS.slice(0, 5).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    className="h-4 w-4 rounded-full transition-transform"
                    style={{
                      backgroundColor: color,
                      transform: newTagColor === color ? 'scale(1.3)' : 'scale(1)',
                      boxShadow: newTagColor === color ? `0 0 0 1.5px hsl(var(--background)), 0 0 0 2.5px ${color}` : 'none',
                    }}
                  />
                ))}
              </div>
              <Button size="sm" variant="ghost" className="h-7 shrink-0 text-xs" onClick={handleCreateNewTag} disabled={!newTagName.trim()}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subtareas</label>
            {subtasks.map((subtask, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground text-xs">•</span>
                <span className="flex-1">{subtask}</span>
                <button type="button" onClick={() => setSubtasks((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}>
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input placeholder="Agregar subtarea..." value={newSubtask} onChange={(event) => setNewSubtask(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleAddSubtask()} className="h-8 text-sm" />
              <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={handleAddSubtask}><Plus className="h-3 w-3" /></Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nota inicial (opcional)</label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contexto, observaciones iniciales..." className="text-sm min-h-[60px] resize-none" />
          </div>

          {/* ═══════════ Relaciones inline ═══════════ */}
          {/* Declarar dependencias y bloqueos en el momento de la creación. Se */}
          {/* persisten post-insert de la tarea via task_relationships. */}
          <div className="space-y-1.5 rounded-lg border border-dashed p-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Relaciones y dependencias</label>
              {!relSlotOpen && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRelSlotOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Añadir
                </Button>
              )}
            </div>

            {/* Chips of pending relationships */}
            {pendingRelationships.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pendingRelationships.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2 py-1 text-[11px]">
                    <span className="font-medium text-violet-900">{EDGE_LABELS[r.edge_type] ?? r.edge_type.toLowerCase()}:</span>
                    <span className="text-violet-800 truncate max-w-[10rem]">{r.target_label}</span>
                    {r.reason && <span className="italic text-violet-700 truncate max-w-[10rem]">— {r.reason}</span>}
                    <button
                      onClick={() => setPendingRelationships((prev) => prev.filter((_, i) => i !== idx))}
                      className="ml-0.5 rounded p-0.5 hover:bg-violet-100 text-violet-600"
                      aria-label="Eliminar relación"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inline picker to add a new one */}
            {relSlotOpen && (() => {
              const slot = RELATIONSHIP_SLOTS.find((s) => s.key === relSlotKey) ?? RELATIONSHIP_SLOTS[0];
              const targetOptions: Array<{ id: string; label: string }> = (() => {
                switch (slot.target_type) {
                  case 'task': return topics.map((t) => ({ id: t.id, label: t.title }));
                  case 'user': return assignees.map((a) => ({ id: a.id, label: a.name }));
                  case 'area': return departments.map((d) => ({ id: d.id, label: d.name }));
                  case 'project': return projects.map((p) => ({ id: p.id, label: p.name }));
                  case 'client': return clients.map((c) => ({ id: c.id, label: c.name }));
                  default: return [];
                }
              })();
              const canAdd = !!relTargetId && targetOptions.some((o) => o.id === relTargetId);
              return (
                <div className="space-y-2 rounded-md border bg-background p-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Tipo</p>
                      <Select value={relSlotKey} onValueChange={(v) => { setRelSlotKey(v); setRelTargetId(''); }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RELATIONSHIP_SLOTS.map((s) => (
                            <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground mt-1">{slot.helper}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Destino</p>
                      <Select value={relTargetId} onValueChange={setRelTargetId}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                          {targetOptions.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">Sin opciones disponibles</div>
                          ) : targetOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Input
                    placeholder="Motivo / contexto (opcional)"
                    value={relReason}
                    onChange={(e) => setRelReason(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => { setRelSlotOpen(false); setRelTargetId(''); setRelReason(''); }}>
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="h-7"
                      disabled={!canAdd}
                      onClick={() => {
                        const option = targetOptions.find((o) => o.id === relTargetId)!;
                        setPendingRelationships((prev) => [
                          ...prev,
                          {
                            edge_type: slot.edge_type,
                            target_type: slot.target_type,
                            target_id: relTargetId,
                            target_label: option.label,
                            reason: relReason.trim() || undefined,
                          },
                        ]);
                        setRelSlotOpen(false);
                        setRelTargetId('');
                        setRelReason('');
                      }}
                    >
                      <Check className="h-3 w-3 mr-1" /> Agregar
                    </Button>
                  </div>
                </div>
              );
            })()}

            {pendingRelationships.length === 0 && !relSlotOpen && (
              <p className="text-[11px] text-muted-foreground italic">
                Opcional. Si declaras dependencias aquí, el grafo las muestra al instante.
              </p>
            )}
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={!title.trim() || isPending}>
            {isPending ? 'Creando...' : 'Crear Tema'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
