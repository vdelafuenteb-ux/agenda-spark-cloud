import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarCheck, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DailySummarySettings() {
  const [enabled, setEnabled] = useState(true);
  const [hour, setHour] = useState(8);
  const [testing, setTesting] = useState(false);

  const handleTestSend = async () => {
    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke('send-daily-summary', {
        body: {},
      });
      if (error) throw error;
      toast.success('Resumen diario enviado a tu correo');
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CalendarCheck className="h-4 w-4" />
          Resumen Diario
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Enable */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Resumen diario por correo</p>
            <p className="text-xs text-muted-foreground">
              Recibe cada mañana un resumen con tus temas del día, atrasados y próximos a vencer
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <>
            {/* Hour */}
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5">⏰ Hora de envío</p>
              <div className="flex items-center gap-2">
                <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map(h => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">hrs (Chile)</span>
              </div>
            </div>

            {/* Destination */}
            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-1.5">📧 Destinatario</p>
              <p className="text-xs text-muted-foreground">matias@transitglobalgroup.com</p>
            </div>

            {/* What's included */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-sm font-semibold flex items-center gap-1.5">📋 Contenido del resumen</p>
              <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>📌 Temas y subtareas que vencen hoy</li>
                <li>🔴 Temas y subtareas atrasados</li>
                <li>🟡 Próximos a vencer (3 días)</li>
                <li>✅ Checklist del día</li>
              </ul>
              <p className="text-[11px] text-muted-foreground mt-2">
                Se envía todos los días a las <strong>{String(hour).padStart(2, '0')}:00</strong> hora Chile
              </p>
            </div>

            {/* Test button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestSend}
              disabled={testing}
              className="gap-1.5"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar resumen ahora (prueba)
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
