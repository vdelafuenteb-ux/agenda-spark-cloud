import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trash2, Mail, Copy, UserPlus, Pencil, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace, type WorkspaceRole } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Member {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  display_name: string;
  email: string;
}

interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expires_at: string;
  accepted: boolean;
  created_at: string;
}

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Lector',
};

const ROLE_DESC: Record<WorkspaceRole, string> = {
  owner: 'Control total. No editable.',
  admin: 'Gestiona miembros, configuración, informes y correos.',
  editor: 'Crea y edita temas, notas, contactos.',
  viewer: 'Solo lectura.',
};

export function WorkspaceMembersView() {
  const { user } = useAuth();
  const { activeWorkspace, activeWorkspaceId, canAdmin, isOwner, renameWorkspace, refresh } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor');
  const [editingName, setEditingName] = useState(false);
  const [wsName, setWsName] = useState('');

  const fetchData = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);

    const { data: memberRows } = await supabase
      .from('workspace_members')
      .select('id, user_id, role, joined_at')
      .eq('workspace_id', activeWorkspaceId);

    const userIds = (memberRows ?? []).map((m) => m.user_id);
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('user_id, display_name, email').in('user_id', userIds)
      : { data: [] as any[] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    setMembers(
      (memberRows ?? []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        display_name: profileMap.get(m.user_id)?.display_name ?? '—',
        email: profileMap.get(m.user_id)?.email ?? '',
      }))
    );

    const { data: invs } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('workspace_id', activeWorkspaceId)
      .eq('accepted', false)
      .order('created_at', { ascending: false });
    setInvitations((invs ?? []) as Invitation[]);

    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    setWsName(activeWorkspace?.name ?? '');
  }, [activeWorkspace?.name]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activeWorkspaceId || !user) return;
    const { error } = await supabase.from('workspace_invitations').insert({
      workspace_id: activeWorkspaceId,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Invitación creada');
    setInviteEmail('');
    fetchData();
  };

  const handleChangeRole = async (memberId: string, role: WorkspaceRole) => {
    const { error } = await supabase.from('workspace_members').update({ role }).eq('id', memberId);
    if (error) { toast.error(error.message); return; }
    toast.success('Rol actualizado');
    fetchData();
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from('workspace_members').delete().eq('id', memberId);
    if (error) { toast.error(error.message); return; }
    toast.success('Miembro removido');
    fetchData();
  };

  const handleDeleteInvite = async (id: string) => {
    const { error } = await supabase.from('workspace_invitations').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Invitación eliminada');
    fetchData();
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Enlace copiado');
  };

  const handleRename = async () => {
    if (!activeWorkspaceId || !wsName.trim()) return;
    try {
      await renameWorkspace(activeWorkspaceId, wsName.trim());
      toast.success('Workspace actualizado');
      setEditingName(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!activeWorkspace) {
    return <p className="text-sm text-muted-foreground">Selecciona un workspace.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Workspace info */}
      <div>
        <h2 className="text-lg font-semibold">Workspace</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Información del espacio de trabajo activo.</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">Nombre</div>
            {!editingName && isOwner && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setEditingName(true)}>
                <Pencil className="h-3 w-3" /> Editar
              </Button>
            )}
          </div>
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input value={wsName} onChange={(e) => setWsName(e.target.value)} className="h-9" autoFocus />
              <Button size="sm" onClick={handleRename}><Check className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setWsName(activeWorkspace.name); }}><X className="h-3.5 w-3.5" /></Button>
            </div>
          ) : (
            <div className="text-base font-medium">{activeWorkspace.name}</div>
          )}
          <div className="text-xs text-muted-foreground">
            Tu rol: <Badge variant="outline" className="ml-1 capitalize">{ROLE_LABEL[activeWorkspace.role]}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Invite */}
      {canAdmin && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Invitar persona
          </h3>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-[1fr_140px_auto] gap-2">
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  className="h-9 text-sm"
                />
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as WorkspaceRole)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Lector</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleInvite} disabled={!inviteEmail.trim()}>Invitar</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {ROLE_DESC[inviteRole]}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Invitaciones pendientes</h3>
          <Card>
            <CardContent className="p-4 divide-y divide-border">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{inv.email}</span>
                      <Badge variant="outline" className="text-[10px] capitalize h-4 px-1.5">{ROLE_LABEL[inv.role]}</Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Expira: {new Date(inv.expires_at).toLocaleDateString('es-CL')}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => copyInviteLink(inv.token)}>
                    <Copy className="h-3 w-3" /> Copiar link
                  </Button>
                  {canAdmin && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteInvite(inv.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Members */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Miembros ({members.length})</h3>
        <Card>
          <CardContent className="p-4 divide-y divide-border">
            {loading && <p className="text-sm text-muted-foreground py-4 text-center">Cargando...</p>}
            {!loading && members.map((m) => {
              const isSelf = m.user_id === user?.id;
              const canEditRole = canAdmin && !isSelf && m.role !== 'owner';
              return (
                <div key={m.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {(m.display_name || m.email).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      {m.display_name}
                      {isSelf && <span className="text-[10px] text-muted-foreground">(tú)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                  </div>
                  {canEditRole ? (
                    <Select value={m.role} onValueChange={(v) => handleChangeRole(m.id, v as WorkspaceRole)}>
                      <SelectTrigger className="h-8 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Lector</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="capitalize text-[10px]">{ROLE_LABEL[m.role]}</Badge>
                  )}
                  {canAdmin && !isSelf && m.role !== 'owner' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Quitar a {m.display_name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Perderá acceso a este workspace inmediatamente. Puedes invitarlo de nuevo después.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemoveMember(m.id)}>Quitar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
