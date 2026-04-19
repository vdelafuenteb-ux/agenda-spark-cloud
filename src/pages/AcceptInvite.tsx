import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Building2, Loader2 } from 'lucide-react';

interface InvitationDetails {
  id: string;
  workspace_id: string;
  workspace_name: string;
  email: string;
  role: string;
  expires_at: string;
  accepted: boolean;
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn } = useAuth();
  const { refresh, setActiveWorkspaceId } = useWorkspace();
  const [invite, setInvite] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Sign in / sign up form
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) { setError('Token inválido'); setLoading(false); return; }
      const { data, error } = await supabase
        .from('workspace_invitations')
        .select('id, workspace_id, email, role, expires_at, accepted, workspaces(name)')
        .eq('token', token)
        .maybeSingle();
      if (error || !data) { setError('Invitación no encontrada'); setLoading(false); return; }
      if (data.accepted) { setError('Esta invitación ya fue aceptada'); setLoading(false); return; }
      if (new Date(data.expires_at) < new Date()) { setError('Esta invitación ha expirado'); setLoading(false); return; }
      setInvite({
        id: data.id,
        workspace_id: data.workspace_id,
        workspace_name: (data.workspaces as any)?.name ?? 'Workspace',
        email: data.email,
        role: data.role,
        expires_at: data.expires_at,
        accepted: data.accepted,
      });
      setEmail(data.email);
      setLoading(false);
    };
    fetchInvite();
  }, [token]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/invite/${token}`,
            data: { display_name: displayName || email.split('@')[0] },
          },
        });
        if (error) throw error;
        toast.success('Cuenta creada. Revisa tu email para confirmarla.');
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!invite || !user) return;
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      toast.error(`Esta invitación es para ${invite.email}. Inicia sesión con ese correo.`);
      return;
    }
    setAccepting(true);
    try {
      // Add member
      const { error: memberErr } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: invite.workspace_id,
          user_id: user.id,
          role: invite.role as any,
        });
      if (memberErr && !memberErr.message.includes('duplicate')) throw memberErr;

      // Mark accepted
      await supabase
        .from('workspace_invitations')
        .update({ accepted: true, accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      await refresh();
      setActiveWorkspaceId(invite.workspace_id);
      toast.success(`Bienvenido a ${invite.workspace_name}`);
      navigate('/');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <h1 className="text-xl font-semibold">Invitación no válida</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => navigate('/')} variant="outline">Volver al inicio</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">Te invitaron a {invite?.workspace_name}</h1>
            <p className="text-sm text-muted-foreground">
              Como <span className="font-medium capitalize">{invite?.role}</span> · {invite?.email}
            </p>
          </div>

          {!user ? (
            <form onSubmit={handleAuth} className="space-y-3">
              <div className="flex gap-1 p-1 bg-muted rounded-md">
                <button type="button" onClick={() => setMode('signup')} className={`flex-1 text-xs py-1.5 rounded ${mode === 'signup' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                  Crear cuenta
                </button>
                <button type="button" onClick={() => setMode('signin')} className={`flex-1 text-xs py-1.5 rounded ${mode === 'signin' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                  Ya tengo cuenta
                </button>
              </div>
              {mode === 'signup' && (
                <Input placeholder="Tu nombre" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              )}
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled />
              <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Procesando...' : (mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión')}
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-center">
                Conectado como <span className="font-medium">{user.email}</span>
              </p>
              <Button onClick={handleAccept} className="w-full" disabled={accepting}>
                {accepting ? 'Aceptando...' : 'Aceptar invitación'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={async () => { await supabase.auth.signOut(); }}>
                Cerrar sesión y usar otra cuenta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
