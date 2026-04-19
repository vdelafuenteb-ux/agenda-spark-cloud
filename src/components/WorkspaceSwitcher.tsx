import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  collapsed?: boolean;
}

export function WorkspaceSwitcher({ collapsed }: Props) {
  const { workspaces, activeWorkspace, setActiveWorkspaceId, createWorkspace } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createWorkspace(name.trim());
      toast.success('Workspace creado');
      setCreateOpen(false);
      setName('');
    } catch (e: any) {
      toast.error(e.message ?? 'Error al crear workspace');
    } finally {
      setCreating(false);
    }
  };

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center justify-center h-9 rounded-md hover:bg-accent transition-colors">
            <Building2 className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <WSContent
          workspaces={workspaces}
          activeId={activeWorkspace?.id ?? null}
          onSelect={setActiveWorkspaceId}
          onCreate={() => setCreateOpen(true)}
        />
        <CreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          name={name}
          setName={setName}
          onCreate={handleCreate}
          loading={creating}
        />
      </DropdownMenu>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border border-border bg-background hover:bg-accent transition-colors text-left">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">
                  {activeWorkspace?.name ?? 'Sin workspace'}
                </div>
                {activeWorkspace && (
                  <div className="text-[10px] text-muted-foreground capitalize">
                    {activeWorkspace.role}
                  </div>
                )}
              </div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <WSContent
          workspaces={workspaces}
          activeId={activeWorkspace?.id ?? null}
          onSelect={setActiveWorkspaceId}
          onCreate={() => setCreateOpen(true)}
        />
      </DropdownMenu>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        name={name}
        setName={setName}
        onCreate={handleCreate}
        loading={creating}
      />
    </>
  );
}

function WSContent({
  workspaces,
  activeId,
  onSelect,
  onCreate,
}: {
  workspaces: ReturnType<typeof useWorkspace>['workspaces'];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <DropdownMenuContent align="start" className="w-64">
      <DropdownMenuLabel className="text-xs">Tus workspaces</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {workspaces.length === 0 && (
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          No tienes workspaces.
        </div>
      )}
      {workspaces.map((w) => (
        <DropdownMenuItem
          key={w.id}
          onClick={() => onSelect(w.id)}
          className="flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Check
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                activeId === w.id ? 'opacity-100' : 'opacity-0'
              )}
            />
            <span className="truncate text-sm">{w.name}</span>
          </div>
          <Badge variant="outline" className="text-[10px] capitalize h-4 px-1.5">
            {w.role}
          </Badge>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onCreate} className="gap-2">
        <Plus className="h-3.5 w-3.5" />
        <span className="text-sm">Crear workspace</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  name,
  setName,
  onCreate,
  loading,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  name: string;
  setName: (s: string) => void;
  onCreate: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo workspace</DialogTitle>
          <DialogDescription>
            Cada workspace tiene sus propios temas, notas, equipo y configuración.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Nombre del workspace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCreate()}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onCreate} disabled={!name.trim() || loading}>
            {loading ? 'Creando...' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
