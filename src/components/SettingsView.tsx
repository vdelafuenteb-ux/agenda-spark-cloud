import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Pencil, Check, X, Mail, Tag, Users, Clock, CalendarCheck, Building2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { Tag as TagType } from '@/hooks/useTags';
import type { Assignee } from '@/hooks/useAssignees';
import type { Department } from '@/hooks/useDepartments';
import { EmailScheduleSettings } from '@/components/EmailScheduleSettings';
import { cn } from '@/lib/utils';
import { DailySummarySettings } from '@/components/DailySummarySettings';
import { ReminderEmailSettings } from '@/components/ReminderEmailSettings';


const TAG_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

type SettingsSection = 'etiquetas' | 'responsables' | 'departamentos' | 'correos_automaticos' | 'resumen_diario';

const SECTIONS: { key: SettingsSection; label: string; icon: typeof Tag }[] = [
  { key: 'etiquetas', label: 'Etiquetas', icon: Tag },
  { key: 'responsables', label: 'Responsables', icon: Users },
  { key: 'departamentos', label: 'Departamentos', icon: Building2 },
  { key: 'correos_automaticos', label: 'Correos Automáticos', icon: Clock },
  { key: 'resumen_diario', label: 'Resumen Diario', icon: CalendarCheck },
];

interface SettingsViewProps {
  tags: TagType[];
  assignees: Assignee[];
  departments: Department[];
  topics: { id: string; title: string; assignee: string | null; status: string }[];
  onDeleteTag: (id: string) => void;
  onCreateTag: (data: { name: string; color: string }) => Promise<any>;
  onUpdateTag: (id: string, name: string) => void;
  onDeleteAssignee: (id: string) => void;
  onCreateAssignee: (name: string) => Promise<any>;
  onUpdateAssignee: (id: string, data: { name?: string; email?: string | null; weekly_capacity?: number; department_id?: string | null }) => void;
  onCreateDepartment: (name: string) => Promise<any>;
  onUpdateDepartment: (id: string, name: string) => void;
  onDeleteDepartment: (id: string) => void;
}

function DeleteConfirm({ title, description, onConfirm, children }: { title: string; description: string; onConfirm: () => void; children: React.ReactNode }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ActionButtons({ onEdit, onDelete, deleteTitle, deleteDesc }: { onEdit: () => void; onDelete: () => void; deleteTitle: string; deleteDesc: string }) {
  return (
    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <DeleteConfirm title={deleteTitle} description={deleteDesc} onConfirm={onDelete}>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </DeleteConfirm>
    </div>
  );
}

export function SettingsView({ tags, assignees, departments, topics, onDeleteTag, onCreateTag, onUpdateTag, onDeleteAssignee, onCreateAssignee, onUpdateAssignee, onCreateDepartment, onUpdateDepartment, onDeleteDepartment }: SettingsViewProps) {
  const [section, setSection] = useState<SettingsSection>('etiquetas');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newAssigneeName, setNewAssigneeName] = useState('');
  const [newAssigneeEmail, setNewAssigneeEmail] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingAssigneeId, setEditingAssigneeId] = useState<string | null>(null);
  const [editingAssigneeName, setEditingAssigneeName] = useState('');
  const [editingAssigneeEmail, setEditingAssigneeEmail] = useState('');
  const [editingAssigneeCapacity, setEditingAssigneeCapacity] = useState(45);
  const [editingAssigneeDeptId, setEditingAssigneeDeptId] = useState<string | null>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDeptName, setEditingDeptName] = useState('');

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await onCreateTag({ name: newTagName.trim(), color: newTagColor });
      setNewTagName('');
      toast.success('Etiqueta creada');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateAssignee = async () => {
    if (!newAssigneeName.trim()) return;
    try {
      const created = await onCreateAssignee(newAssigneeName.trim());
      if (newAssigneeEmail.trim()) onUpdateAssignee(created.id, { email: newAssigneeEmail.trim() });
      setNewAssigneeName('');
      setNewAssigneeEmail('');
      toast.success('Responsable creado');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim()) return;
    try {
      await onCreateDepartment(newDeptName.trim());
      setNewDeptName('');
      toast.success('Departamento creado');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSaveTag = (id: string) => {
    if (!editingTagName.trim()) return;
    onUpdateTag(id, editingTagName.trim());
    setEditingTagId(null);
    toast.success('Etiqueta actualizada');
  };

  const handleSaveAssignee = (id: string) => {
    if (!editingAssigneeName.trim()) return;
    onUpdateAssignee(id, { name: editingAssigneeName.trim(), email: editingAssigneeEmail.trim() || null, weekly_capacity: editingAssigneeCapacity, department_id: editingAssigneeDeptId });
    setEditingAssigneeId(null);
    toast.success('Responsable actualizado');
  };

  const handleSaveDepartment = (id: string) => {
    if (!editingDeptName.trim()) return;
    onUpdateDepartment(id, editingDeptName.trim());
    setEditingDeptId(null);
    toast.success('Departamento actualizado');
  };

  return (
    <main className="flex-1 overflow-hidden flex flex-col md:flex-row">
      {/* Sidebar nav */}
      <nav className="shrink-0 border-b md:border-b-0 md:border-r border-border bg-muted/20 overflow-x-auto md:overflow-y-auto md:w-52">
        <div className="flex md:flex-col p-2 md:p-4 gap-0.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left whitespace-nowrap shrink-0',
                  section === s.key
                    ? 'bg-background text-foreground shadow-sm border border-border/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {s.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-1">

          {/* ═══════════ ETIQUETAS ═══════════ */}
          {section === 'etiquetas' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Etiquetas</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Organiza tus temas con etiquetas de colores.</p>
              </div>

              <Card>
                <CardContent className="p-4 space-y-4">
                  {/* Create form */}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Nueva etiqueta..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                      className="h-9 text-sm flex-1"
                    />
                    <div className="flex gap-1 items-center">
                      {TAG_COLORS.map((c) => (
                        <button
                          key={c}
                          className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 shrink-0"
                          style={{ backgroundColor: c, borderColor: c === newTagColor ? 'hsl(var(--foreground))' : 'transparent' }}
                          onClick={() => setNewTagColor(c)}
                        />
                      ))}
                    </div>
                    <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleCreateTag} disabled={!newTagName.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No hay etiquetas creadas aún.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {tags.map((tag) => (
                        <div key={tag.id} className="group flex items-center justify-between py-2.5 px-1">
                          {editingTagId === tag.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                              <Input
                                value={editingTagName}
                                onChange={(e) => setEditingTagName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTag(tag.id); if (e.key === 'Escape') setEditingTagId(null); }}
                                className="h-8 text-sm flex-1"
                                autoFocus
                              />
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500" onClick={() => handleSaveTag(tag.id)}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingTagId(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2.5">
                                <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                <span className="text-sm">{tag.name}</span>
                              </div>
                              <ActionButtons
                                onEdit={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); }}
                                onDelete={() => { onDeleteTag(tag.id); toast.success('Etiqueta eliminada'); }}
                                deleteTitle="¿Eliminar etiqueta?"
                                deleteDesc={`Se eliminará la etiqueta "${tag.name}" y se quitará de todos los temas asociados.`}
                              />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════ RESPONSABLES ═══════════ */}
          {section === 'responsables' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Responsables</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Gestiona las personas asignadas a temas y tareas.</p>
              </div>

              <Card>
                <CardContent className="p-4 space-y-4">
                  {/* Create form */}
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      placeholder="Nombre..."
                      value={newAssigneeName}
                      onChange={(e) => setNewAssigneeName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateAssignee()}
                      className="h-9 text-sm"
                    />
                    <Input
                      placeholder="correo@ejemplo.com"
                      value={newAssigneeEmail}
                      onChange={(e) => setNewAssigneeEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateAssignee()}
                      className="h-9 text-sm"
                      type="email"
                    />
                    <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleCreateAssignee} disabled={!newAssigneeName.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {assignees.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No hay responsables creados aún.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {assignees.map((a) => (
                        <div key={a.id} className="group py-2.5 px-1">
                          {editingAssigneeId === a.id ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  value={editingAssigneeName}
                                  onChange={(e) => setEditingAssigneeName(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAssignee(a.id); if (e.key === 'Escape') setEditingAssigneeId(null); }}
                                  className="h-8 text-sm"
                                  placeholder="Nombre"
                                  autoFocus
                                />
                                <Input
                                  value={editingAssigneeEmail}
                                  onChange={(e) => setEditingAssigneeEmail(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAssignee(a.id); if (e.key === 'Escape') setEditingAssigneeId(null); }}
                                  className="h-8 text-sm"
                                  placeholder="correo@ejemplo.com"
                                  type="email"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span>Capacidad:</span>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={editingAssigneeCapacity}
                                    onChange={(e) => setEditingAssigneeCapacity(parseInt(e.target.value) || 45)}
                                    className="h-8 text-sm w-20"
                                  />
                                  <span>h/sem</span>
                                </div>
                                <Select value={editingAssigneeDeptId || 'none'} onValueChange={(v) => setEditingAssigneeDeptId(v === 'none' ? null : v)}>
                                  <SelectTrigger className="h-8 text-xs flex-1">
                                    <SelectValue placeholder="Departamento" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Sin departamento</SelectItem>
                                    {departments.map((d) => (
                                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button variant="default" size="sm" className="h-8 text-xs gap-1 px-3" onClick={() => handleSaveAssignee(a.id)}>
                                  <Check className="h-3.5 w-3.5" />
                                  Guardar
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditingAssigneeId(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                  <span className="text-xs font-semibold text-muted-foreground">{a.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{a.name}</span>
                                    {(() => {
                                      const dept = departments.find(d => d.id === a.department_id);
                                      return dept ? (
                                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{dept.name}</span>
                                      ) : null;
                                    })()}
                                  </div>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    {a.email ? (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                        <Mail className="h-3 w-3 shrink-0" />
                                        {a.email}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground/40 italic">Sin correo</span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">{a.weekly_capacity || 45}h/sem</span>
                                  </div>
                                </div>
                              </div>
                              <ActionButtons
                                onEdit={() => {
                                  setEditingAssigneeId(a.id);
                                  setEditingAssigneeName(a.name);
                                  setEditingAssigneeEmail(a.email || '');
                                  setEditingAssigneeCapacity(a.weekly_capacity || 45);
                                  setEditingAssigneeDeptId(a.department_id || null);
                                }}
                                onDelete={() => { onDeleteAssignee(a.id); toast.success('Responsable eliminado'); }}
                                deleteTitle="¿Eliminar responsable?"
                                deleteDesc={`Se eliminará "${a.name}" de la lista. Los temas asignados no se modificarán.`}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════ DEPARTAMENTOS ═══════════ */}
          {section === 'departamentos' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Departamentos</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Organiza a tus responsables por área de trabajo.</p>
              </div>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Nuevo departamento..."
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateDepartment()}
                      className="h-9 text-sm flex-1"
                    />
                    <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleCreateDepartment} disabled={!newDeptName.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {departments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No hay departamentos creados aún.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {departments.map((dept) => {
                        const memberCount = assignees.filter(a => a.department_id === dept.id).length;
                        return (
                          <div key={dept.id} className="group flex items-center justify-between py-3 px-1">
                            {editingDeptId === dept.id ? (
                              <div className="flex items-center gap-2 flex-1">
                                <Input
                                  value={editingDeptName}
                                  onChange={(e) => setEditingDeptName(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDepartment(dept.id); if (e.key === 'Escape') setEditingDeptId(null); }}
                                  className="h-8 text-sm flex-1"
                                  autoFocus
                                />
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500" onClick={() => handleSaveDepartment(dept.id)}>
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingDeptId(null)}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2.5">
                                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium">{dept.name}</span>
                                    <p className="text-[10px] text-muted-foreground">{memberCount} {memberCount === 1 ? 'miembro' : 'miembros'}</p>
                                  </div>
                                </div>
                                <ActionButtons
                                  onEdit={() => { setEditingDeptId(dept.id); setEditingDeptName(dept.name); }}
                                  onDelete={() => { onDeleteDepartment(dept.id); toast.success('Departamento eliminado'); }}
                                  deleteTitle="¿Eliminar departamento?"
                                  deleteDesc={`Se eliminará "${dept.name}". Los responsables asignados quedarán sin departamento.`}
                                />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════ CORREOS AUTOMÁTICOS ═══════════ */}
          {section === 'correos_automaticos' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Correos Automáticos</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Configura el envío programado de correos a responsables.</p>
              </div>
              <EmailScheduleSettings assignees={assignees} topics={topics} />
              <ReminderEmailSettings assignees={assignees} />
            </div>
          )}

          {/* ═══════════ RESUMEN DIARIO ═══════════ */}
          {section === 'resumen_diario' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Resumen Diario</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Recibe un resumen de tus tareas del día por correo.</p>
              </div>
              <DailySummarySettings />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
