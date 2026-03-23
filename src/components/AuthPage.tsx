import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Se envió un enlace de recuperación a tu email');
      setForgotMode(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (forgotMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-8 px-4">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Recuperar contraseña
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ingresa tu email para recibir un enlace de recuperación
            </p>
          </div>
          <form onSubmit={handleForgot} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </Button>
            <button
              type="button"
              onClick={() => setForgotMode(false)}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Volver al inicio de sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Personal Agenda
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Inicia sesión para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Cargando...' : 'Ingresar'}
          </Button>
          <button
            type="button"
            onClick={() => setForgotMode(true)}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </form>
      </div>
    </div>
  );
}
