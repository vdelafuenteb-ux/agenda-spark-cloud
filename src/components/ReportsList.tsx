import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function ReportsList() {
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reports').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando informes...</p>;
  if (reports.length === 0) return <p className="text-sm text-muted-foreground">No hay informes generados aún.</p>;

  return (
    <div className="space-y-3">
      {reports.map(r => (
        <div key={r.id} className="bg-card rounded-lg shadow-sm p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-card-foreground">{r.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(r.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => {
                  navigator.clipboard.writeText(r.content);
                  toast.success('Copiado');
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-destructive hover:text-destructive"
                onClick={() => deleteReport.mutate(r.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              Ver contenido
            </summary>
            <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-foreground/80 bg-muted/30 rounded p-3">
              {r.content}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
}
