import { useState } from 'react';
import { Building2, LogOut, Plus, ArrowRight, Trash2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

export function WorkspaceLanding() {
  const { user, signOut } = useAuth();
  const { workspaces, setActiveWorkspaceId, createWorkspace, renameWorkspace, deleteWorkspace, loading } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteWorkspace(confirmDelete.id);
      toast.success(`Workspace "${confirmDelete.name}" eliminado`);
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo eliminar el workspace');
    } finally {
      setDeleting(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editingName.trim()) { setEditingId(null); return; }
    try {
      await renameWorkspace(id, editingName.trim());
      toast.success('Workspace renombrado');
      setEditingId(null);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo renombrar');
    }
  };

  const displayName = (user?.user_metadata?.name as string) || user?.email?.split('@')[0] || 'colaborador';

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const ws = await createWorkspace(name.trim());
      toast.success(`Workspace "${ws.name}" creado`);
      setOpen(false);
      setName('');
      setActiveWorkspaceId(ws.id);
    } catch (e: any) {
      console.error('[WorkspaceLanding] createWorkspace error:', e);
      toast.error(e?.message || 'No se pudo crear el workspace');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8">
        <header className="text-center space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Hola <span className="capitalize">{displayName}</span> 👋
          </h1>
          <p className="text-muted-foreground text-sm">
            Elige un workspace para empezar a trabajar o crea uno nuevo.
          </p>
        </header>

        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {loading ? (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              Cargando tus workspaces...
            </div>
          ) : workspaces.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed bg-card p-10 text-center space-y-3">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <div>
                <h3 className="font-semibold text-foreground">No tienes workspaces aún</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Crea uno para organizar tus temas, tareas y colaboradores.
                </p>
              </div>
              <Button onClick={() => setOpen(true)} className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Crear mi primer workspace
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                {workspaces.map((ws) => {
                  const isOwner = ws.role === 'owner';
                  const isEditing = editingId === ws.id;
                  return (
                    <div
                      key={ws.id}
                      className="group rounded-xl border bg-card p-5 hover:border-primary hover:shadow-sm transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <Input
                                autoFocus
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRename(ws.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-8 text-sm"
                              />
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleRename(ws.id); }}>
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setActiveWorkspaceId(ws.id)}
                              className="text-left w-full"
                            >
                              <p className="font-medium truncate">{ws.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{ws.role}</p>
                            </button>
                          )}
                        </div>
                      </div>
                      {!isEditing && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isOwner && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={(e) => { e.stopPropagation(); setEditingId(ws.id); setEditingName(ws.name); }}
                                title="Renombrar"
                              >
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: ws.id, name: ws.name }); }}
                                title="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </>
                          )}
                          <ArrowRight
                            className="h-5 w-5 text-muted-foreground ml-1 cursor-pointer"
                            onClick={() => setActiveWorkspaceId(ws.id)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button
                variant="outline"
                onClick={() => setOpen(true)}
                className="w-full border-dashed"
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear otro workspace
              </Button>
            </>
          )}
        </div>

        <footer className="flex justify-center pt-4">
          <button
            onClick={() => signOut()}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Cerrar sesión ({user?.email})
          </button>
        </footer>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>"{confirmDelete?.name}"</strong> y <strong>todos sus datos</strong> (temas,
              subtareas, responsables, etiquetas, notas, correos programados, reportes, etc.).
              <br /><br />
              Esta acción <strong className="text-destructive">no se puede deshacer</strong>. Los miembros del workspace perderán el acceso inmediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Eliminando...' : 'Sí, eliminar todo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo workspace</DialogTitle>
            <DialogDescription>
              Cada workspace es un espacio independiente con sus propios temas, tareas, responsables y correos.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Ej: Transit Chile, Proyecto Alpha, Mi Agenda"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !creating && handleCreate()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || creating}>
              {creating ? 'Creando...' : 'Crear workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
