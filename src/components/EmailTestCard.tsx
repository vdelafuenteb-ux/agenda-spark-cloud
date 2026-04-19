import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';

export function EmailTestCard() {
  const { user } = useAuth();
  const [to, setTo] = useState(user?.email ?? '');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error('Ingresa un email destinatario');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-email', { body: { to: to.trim() } });
      if (error) {
        toast.error(`Falló: ${error.message || 'error desconocido'}`, { duration: 8000 });
      } else {
        toast.success(`Correo enviado a ${to.trim()} (revisa bandeja y spam)`, { duration: 6000 });
      }
      console.log('[test-email] result:', data, error);
    } catch (e: any) {
      toast.error(`Falló: ${e?.message || 'error'}`, { duration: 8000 });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Probar envío de correo</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Envía un correo de prueba para verificar que el sistema de notificaciones está funcionando correctamente.
      </p>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="tu@email.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={sending}>
          {sending ? 'Enviando...' : 'Enviar prueba'}
        </Button>
      </div>
    </div>
  );
}
