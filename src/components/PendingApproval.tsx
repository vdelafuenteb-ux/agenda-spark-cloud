import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export function PendingApproval() {
  const { signOut, user } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-6 text-center">
        <div className="text-5xl">⏳</div>
        <h1 className="text-2xl font-semibold tracking-tight">Cuenta pendiente de aprobación</h1>
        <p className="text-sm text-muted-foreground">
          Tu cuenta <strong>{user?.email}</strong> fue creada correctamente, pero un administrador
          debe aprobarla antes de que puedas usar la aplicación. Recibirás acceso cuando sea revisada.
        </p>
        <Button onClick={() => signOut()} variant="outline" className="w-full">
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
