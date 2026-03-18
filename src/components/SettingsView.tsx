import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Pencil, Check, X, Mail, Tag, Users, Clock } from 'lucide-react';
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
import { EmailScheduleSettings } from '@/components/EmailScheduleSettings';
import { cn } from '@/lib/utils';

const TAG_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

type SettingsSection = 'etiquetas' | 'responsables' | 'correos_automaticos';

const SECTIONS: { key: SettingsSection; label: string; icon: typeof Tag }[] = [
  { key: 'etiquetas', label: 'Etiquetas', icon: Tag },
  { key: 'responsables', label: 'Responsables', icon: Users },
  { key: 'correos_automaticos', label: 'Correos Automáticos', icon: Clock },
];

interface SettingsViewProps {
  tags: TagType[];
  assignees: Assignee[];
  topics: { id: string; title: string; assignee: string | null; status: string }[];
  onDeleteTag: (id: string) => void;
  onCreateTag: (data: { name: string; color: string }) => Promise<any>;
  onUpdateTag: (id: string, name: string) => void;
  onDeleteAssignee: (id: string) => void;
  onCreateAssignee: (name: string) => Promise<any>;
  onUpdateAssignee: (id: string, data: { name?: string; email?: string | null }) => void;
}

export function SettingsView({ tags, assignees, topics, onDeleteTag, onCreateTag, onUpdateTag, onDeleteAssignee, onCreateAssignee, onUpdateAssignee }: SettingsViewProps) {
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

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await onCreateTag({ name: newTagName.trim(), color: newTagColor });
      setNewTagName('');
      toast.success('Etiqueta creada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleCreateAssignee = async () => {
    if (!newAssigneeName.trim()) return;
    try {
      const created = await onCreateAssignee(newAssigneeName.trim());
      if (newAssigneeEmail.trim()) {
        onUpdateAssignee(created.id, { email: newAssigneeEmail.trim() });
      }
      setNewAssigneeName('');
      setNewAssigneeEmail('');
      toast.success('Responsable creado');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSaveTag = (id: string) => {
    if (!editingTagName.trim()) return;
    onUpdateTag(id, editingTagName.trim());
    setEditingTagId(null);
    toast.success('Etiqueta actualizada');
  };

  const handleSaveAssignee = (id: string) => {
    if (!editingAssigneeName.trim()) return;
    onUpdateAssignee(id, { name: editingAssigneeName.trim(), email: editingAssigneeEmail.trim() || null });
    setEditingAssigneeId(null);
    toast.success('Responsable actualizado');
  };

  return (
    <main className="flex-1 overflow-hidden flex">
      {/* Sidebar navigation */}
      <nav className="w-48 shrink-0 border-r border-border bg-muted/30 p-3 space-y-1 overflow-y-auto">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left',
                section === s.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {s.label}
            </button>
          );
        })}
      </nav>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          {section === 'etiquetas' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Etiquetas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nueva etiqueta..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                    className="h-8 text-sm flex-1"
                  />
                  <div className="flex gap-1 items-center">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c}
                        className="w-5 h-5 rounded-full border-2 shrink-0"
                        style={{ backgroundColor: c, borderColor: c === newTagColor ? 'hsl(var(--foreground))' : 'transparent' }}
                        onClick={() => setNewTagColor(c)}
                      />
                    ))}
                  </div>
                  <Button size="sm" className="h-8 text-xs gap-1" onClick={handleCreateTag} disabled={!newTagName.trim()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No hay etiquetas creadas.</p>
                ) : (
                  <div className="space-y-1">
                    {tags.map((tag) => (
                      <div key={tag.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                        {editingTagId === tag.id ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                            <Input
                              value={editingTagName}
                              onChange={(e) => setEditingTagName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveTag(tag.id);
                                if (e.key === 'Escape') setEditingTagId(null);
                              }}
                              className="h-7 text-sm flex-1"
                              autoFocus
                            />
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-500" onClick={() => handleSaveTag(tag.id)}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setEditingTagId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                              <span className="text-sm">{tag.name}</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar etiqueta?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se eliminará la etiqueta "{tag.name}" y se quitará de todos los temas asociados.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => { onDeleteTag(tag.id); toast.success('Etiqueta eliminada'); }}>
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {section === 'responsables' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Responsables</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <Input
                    placeholder="Nuevo responsable..."
                    value={newAssigneeName}
                    onChange={(e) => setNewAssigneeName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateAssignee()}
                    className="h-8 text-sm flex-1 min-w-[140px]"
                  />
                  <Input
                    placeholder="correo@ejemplo.com"
                    value={newAssigneeEmail}
                    onChange={(e) => setNewAssigneeEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateAssignee()}
                    className="h-8 text-sm flex-1 min-w-[180px]"
                    type="email"
                  />
                  <Button size="sm" className="h-8 text-xs gap-1" onClick={handleCreateAssignee} disabled={!newAssigneeName.trim()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {assignees.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No hay responsables creados.</p>
                ) : (
                  <div className="space-y-1">
                    {assignees.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                        {editingAssigneeId === a.id ? (
                          <div className="flex items-center gap-2 flex-1 mr-2 flex-wrap">
                            <Input
                              value={editingAssigneeName}
                              onChange={(e) => setEditingAssigneeName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveAssignee(a.id);
                                if (e.key === 'Escape') setEditingAssigneeId(null);
                              }}
                              className="h-7 text-sm flex-1 min-w-[120px]"
                              placeholder="Nombre"
                              autoFocus
                            />
                            <Input
                              value={editingAssigneeEmail}
                              onChange={(e) => setEditingAssigneeEmail(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveAssignee(a.id);
                                if (e.key === 'Escape') setEditingAssigneeId(null);
                              }}
                              className="h-7 text-sm flex-1 min-w-[160px]"
                              placeholder="correo@ejemplo.com"
                              type="email"
                            />
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-500" onClick={() => handleSaveAssignee(a.id)}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setEditingAssigneeId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium">{a.name}</span>
                              {a.email ? (
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate">
                                  <Mail className="h-3 w-3 shrink-0" />
                                  {a.email}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/50 italic">Sin correo</span>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditingAssigneeId(a.id);
                                  setEditingAssigneeName(a.name);
                                  setEditingAssigneeEmail(a.email || '');
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar responsable?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se eliminará "{a.name}" de la lista. Los temas que ya tengan este responsable asignado no se modificarán.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => { onDeleteAssignee(a.id); toast.success('Responsable eliminado'); }}>
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {section === 'correos_automaticos' && (
            <EmailScheduleSettings assignees={assignees} topics={topics} />
          )}
        </div>
      </div>
    </main>
  );
}
