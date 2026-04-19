import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useApproval, type PendingUser } from '@/hooks/useApproval';

export function UserApprovalsView() {
  const { isAdmin, listPending, approveUser, rejectUser } = useApproval();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPending(await listPending());
    } catch (e: any) {
      toast.error(e.message || 'Error cargando solicitudes');
    } finally {
      setLoading(false);
    }
  }, [listPending]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">Solo administradores pueden ver esta sección.</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Solicitudes de acceso</h2>
        <Button variant="outline" size="sm" onClick={refresh}>Refrescar</Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
      ) : (
        <div className="space-y-2">
          {pending.map((u) => (
            <div key={u.uid} className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{u.display_name || u.email}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                {u.created_at && (
                  <p className="text-xs text-muted-foreground">
                    Solicitud: {new Date(u.created_at).toLocaleString('es-CL')}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    try { await approveUser(u.uid); toast.success('Usuario aprobado'); refresh(); }
                    catch (e: any) { toast.error(e.message); }
                  }}
                >
                  Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try { await rejectUser(u.uid); toast.success('Usuario rechazado'); refresh(); }
                    catch (e: any) { toast.error(e.message); }
                  }}
                >
                  Rechazar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
