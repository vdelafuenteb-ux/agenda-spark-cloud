import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { useWorkGraphRelationships } from './useWorkGraphRelationships';
import { EDGE_LABELS, MANUAL_EDGE_TYPES, NODE_COLORS, type WorkEdgeType, type WorkGraphData, type WorkGraphNode } from './types';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  sourceNode: WorkGraphNode | null;
  data: WorkGraphData;
  workspaceId?: string | null;
}

// Modal used from NodeInspector to declare a manual relationship from the
// selected node to any other node in the graph. Source is fixed (the node the
// user was inspecting); target is pickable via search. Edge type and reason
// are required fields.
export function RelationshipEditor({ open, onOpenChange, sourceNode, data, workspaceId }: Props) {
  const { createRelationship } = useWorkGraphRelationships();
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [edgeType, setEdgeType] = useState<WorkEdgeType>('DEPENDS_ON');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = data.nodes.filter((n) => n.id !== sourceNode?.id);
    if (!q) return base.slice(0, 80);
    return base
      .filter((n) => (n.label || '').toLowerCase().includes(q) || (n.subtitle || '').toLowerCase().includes(q))
      .slice(0, 80);
  }, [data.nodes, search, sourceNode]);

  // Keyword suggestions: tokenize the source node's label and surface nodes
  // whose label shares at least one >3-char token. Cheap client-side heuristic
  // — no external LLM needed — that covers the "tarea menciona LATAM LIM →
  // sugerir proyecto LATAM" case from the spec.
  const suggestions = useMemo(() => {
    if (!sourceNode) return [] as WorkGraphNode[];
    const text = `${sourceNode.label ?? ''} ${sourceNode.subtitle ?? ''}`.toLowerCase();
    const tokens = text
      .split(/[\s\-_/,.:;()]+/)
      .filter((t) => t.length > 3)
      .slice(0, 8);
    if (tokens.length === 0) return [];
    const scored: Array<{ node: WorkGraphNode; score: number }> = [];
    for (const n of data.nodes) {
      if (n.id === sourceNode.id) continue;
      if (n.type === 'task') continue; // don't suggest other tasks via keyword match (too noisy)
      const label = (n.label || '').toLowerCase();
      let score = 0;
      for (const tok of tokens) if (label.includes(tok)) score += 1;
      if (score > 0) scored.push({ node: n, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 4).map((s) => s.node);
  }, [data.nodes, sourceNode]);

  const target = useMemo(
    () => (targetId ? data.nodes.find((n) => n.id === targetId) ?? null : null),
    [targetId, data.nodes],
  );

  const handleSave = async () => {
    if (!sourceNode || !target) {
      toast.error('Elige un nodo destino');
      return;
    }
    setSaving(true);
    try {
      await createRelationship.mutateAsync({
        source_type: sourceNode.type,
        source_id: stripPrefix(sourceNode.id),
        target_type: target.type,
        target_id: stripPrefix(target.id),
        edge_type: edgeType,
        reason: reason.trim() || undefined,
        workspace_id: workspaceId ?? null,
      });
      toast.success('Relación creada');
      onOpenChange(false);
      setTargetId(null);
      setReason('');
      setSearch('');
      setEdgeType('DEPENDS_ON');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo crear la relación');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva relación</DialogTitle>
          <DialogDescription>
            Declara una conexión explícita desde <strong>{sourceNode?.label || '—'}</strong> hacia otro nodo del grafo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Tipo de relación</label>
            <Select value={edgeType} onValueChange={(v) => setEdgeType(v as WorkEdgeType)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MANUAL_EDGE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{EDGE_LABELS[t] ?? t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Nodo destino</label>
            {suggestions.length > 0 && !search && (
              <div className="mb-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Sugeridos por el nombre</p>
                <div className="flex flex-wrap gap-1">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setTargetId(s.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition ${targetId === s.id ? 'bg-violet-100 border-violet-300 text-violet-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: NODE_COLORS[s.type] }} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar tarea, responsable, área, proyecto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border">
              {candidates.length === 0 ? (
                <p className="px-3 py-4 text-xs text-slate-500 text-center">Sin resultados</p>
              ) : candidates.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setTargetId(n.id)}
                  className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 hover:bg-slate-50 transition ${targetId === n.id ? 'bg-violet-50' : ''}`}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: NODE_COLORS[n.type] }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{n.label}</p>
                    <p className="text-[10px] text-slate-500 truncate">{n.type}{n.subtitle ? ' · ' + n.subtitle : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Motivo (opcional)</label>
            <Textarea
              placeholder="Ej: esperando firma de contrato, bloqueado por Operaciones, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!target || saving}>
            {saving ? 'Guardando...' : 'Crear relación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function stripPrefix(id: string): string {
  // Node ids are `<type>:<raw>`. We persist only the raw id so the same
  // relationship survives if prefix conventions change in the future.
  const idx = id.indexOf(':');
  return idx === -1 ? id : id.slice(idx + 1);
}
