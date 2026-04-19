import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import ForceGraph2D from 'react-force-graph-2d';
import SpriteText from 'three-spritetext';
import { useWorkGraph } from './useWorkGraph';
import { useGraphStore } from './useGraphStore';
import { GraphFilters } from './GraphFilters';
import { KPIStrip } from './KPIStrip';
import { LeftFilters } from './LeftFilters';
import { InsightsPanel } from './InsightsPanel';
import { NodeInspector } from './NodeInspector';
import { TimelineSlider } from './TimelineSlider';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  DARK_PALETTE,
  LIGHT_PALETTE,
  NODE_COLORS,
  STATUS_TINT,
  type WorkGraphEdge,
  type WorkGraphNode,
} from './types';

function nodeId(n: any): string { return typeof n === 'string' ? n : n?.id; }

export function WorkGraphView() {
  const scope = useGraphStore((s) => s.scope);
  const asOf = useGraphStore((s) => s.asOf);
  const { activeWorkspaceId } = useWorkspace();
  const { data, isLoading } = useWorkGraph({
    crossWorkspace: scope === 'global',
    workspaceId: scope === 'workspace' ? activeWorkspaceId : null,
    asOf,
  });

  const viewMode = useGraphStore((s) => s.viewMode);
  const canvasMode = useGraphStore((s) => s.canvasMode);
  const nodeTypeFilter = useGraphStore((s) => s.nodeTypeFilter);
  const edgeTypeFilter = useGraphStore((s) => s.edgeTypeFilter);
  const statusFilter = useGraphStore((s) => s.statusFilter);
  const userFilter = useGraphStore((s) => s.userFilter);
  const areaFilter = useGraphStore((s) => s.areaFilter);
  const projectFilter = useGraphStore((s) => s.projectFilter);
  const searchQuery = useGraphStore((s) => s.searchQuery);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const hoverNodeId = useGraphStore((s) => s.hoverNodeId);
  const depth = useGraphStore((s) => s.depth);
  const showLabels = useGraphStore((s) => s.showLabels);
  const selectNode = useGraphStore((s) => s.selectNode);
  const hoverNode = useGraphStore((s) => s.hoverNode);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fg3dRef = useRef<any>(null);
  const fg2dRef = useRef<any>(null);

  const palette = canvasMode === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;

  const [size, setSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ width: Math.floor(r.width), height: Math.floor(r.height) });
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ---------- Adjacency + degree ----------
  const { adjacency, degree } = useMemo(() => {
    const adj = new Map<string, Set<string>>();
    const deg = new Map<string, number>();
    for (const n of data.nodes) { adj.set(n.id, new Set()); deg.set(n.id, 0); }
    for (const l of data.links) {
      const s = nodeId(l.source); const t = nodeId(l.target);
      adj.get(s)?.add(t); adj.get(t)?.add(s);
      deg.set(s, (deg.get(s) ?? 0) + 1);
      deg.set(t, (deg.get(t) ?? 0) + 1);
    }
    return { adjacency: adj, degree: deg };
  }, [data]);

  // ---------- Visible subgraph ----------
  // Cascaded filters: type → status → user/area/project/search → local-N-hop if selected.
  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let pool = data.nodes.filter((n) => nodeTypeFilter.has(n.type));
    pool = pool.filter((n) => {
      if (n.type !== 'task') return true;
      if (!n.status) return true;
      return statusFilter.has(n.status);
    });
    if (q) {
      pool = pool.filter((n) =>
        (n.label || '').toLowerCase().includes(q) ||
        (n.subtitle || '').toLowerCase().includes(q),
      );
    }

    // Dropdown filters: user, area, project. Keep the selected entity AND
    // nodes reachable via 1-hop so the user sees context.
    const pivotIds = [userFilter, areaFilter, projectFilter].filter((x): x is string => !!x);
    if (pivotIds.length > 0) {
      const allowed = new Set<string>();
      for (const pivot of pivotIds) {
        allowed.add(pivot);
        for (const nb of adjacency.get(pivot) ?? []) allowed.add(nb);
      }
      pool = pool.filter((n) => allowed.has(n.id));
    }

    const allowedIds = new Set(pool.map((n) => n.id));
    let kept = new Set(pool.map((n) => n.id));

    // Local N-hop view when a node is selected.
    if (selectedNodeId && allowedIds.has(selectedNodeId)) {
      const frontier = new Set<string>([selectedNodeId]);
      const expanded = new Set<string>([selectedNodeId]);
      for (let i = 0; i < depth; i++) {
        const next = new Set<string>();
        for (const id of frontier) for (const nb of adjacency.get(id) ?? []) if (!expanded.has(nb)) { next.add(nb); expanded.add(nb); }
        if (next.size === 0) break;
        frontier.clear(); next.forEach((v) => frontier.add(v));
      }
      kept = new Set([...expanded].filter((id) => allowedIds.has(id) || id === selectedNodeId));
    }

    const keptNodes = data.nodes.filter((n) => kept.has(n.id));
    const keptLinks = data.links.filter(
      (l) => edgeTypeFilter.has(l.type) && kept.has(nodeId(l.source)) && kept.has(nodeId(l.target)),
    );
    return { nodes: keptNodes, links: keptLinks };
  }, [data, nodeTypeFilter, edgeTypeFilter, statusFilter, userFilter, areaFilter, projectFilter, searchQuery, selectedNodeId, depth, adjacency]);

  // ---------- Smart label visibility (hubs + hover/selection) ----------
  const hubThreshold = useMemo(() => {
    const degs = visible.nodes.map((n) => degree.get(n.id) ?? 0).sort((a, b) => b - a);
    if (degs.length === 0) return Infinity;
    const pctIdx = Math.max(0, Math.floor(degs.length * 0.15) - 1);
    return Math.max(3, degs[pctIdx] ?? 3);
  }, [visible.nodes, degree]);

  const highlightedNodes = useMemo(() => {
    const focus = hoverNodeId ?? selectedNodeId;
    if (!focus) return null;
    const neighbors = adjacency.get(focus) ?? new Set();
    const set = new Set(neighbors);
    set.add(focus);
    return set;
  }, [hoverNodeId, selectedNodeId, adjacency]);

  // ---------- Camera animation on selection ----------
  useEffect(() => {
    if (!selectedNodeId) return;
    if (viewMode === '3d' && fg3dRef.current) {
      const n = visible.nodes.find((x: any) => x.id === selectedNodeId) as any;
      if (n && typeof n.x === 'number') {
        const dist = 160;
        const r = Math.hypot(n.x, n.y, n.z || 1) || 1;
        const ratio = 1 + dist / r;
        fg3dRef.current.cameraPosition({ x: n.x * ratio, y: n.y * ratio, z: (n.z || 0) * ratio }, n, 700);
      }
    } else if (viewMode === '2d' && fg2dRef.current) {
      const n = visible.nodes.find((x: any) => x.id === selectedNodeId) as any;
      if (n) fg2dRef.current.centerAt(n.x, n.y, 600);
    }
  }, [selectedNodeId, viewMode, visible.nodes]);

  // ---------- Visual helpers ----------
  const nodeColor = (n: any): string => {
    const node = n as WorkGraphNode;
    if (node.status === 'overdue') return STATUS_TINT.overdue;
    if (node.status === 'blocked') return STATUS_TINT.blocked;
    if (node.status === 'risk') return STATUS_TINT.risk;
    if (node.status === 'completed' || node.status === 'healthy') return STATUS_TINT.completed;
    if (node.type === 'workspace') return palette.nodeWorkspace;
    if (node.type === 'user') return palette.nodeUser;
    if (node.type === 'task') return palette.nodeDefault;
    return NODE_COLORS[node.type] ?? palette.nodeDefault;
  };

  const nodeSize = (n: any) => {
    const d = degree.get(n.id) ?? 0;
    return 2 + Math.sqrt(d) * 0.9 + (n.type === 'workspace' ? 3 : 0);
  };

  const shouldShowLabel = (n: any) => {
    if (!showLabels) return false;
    if (hoverNodeId === n.id || selectedNodeId === n.id) return true;
    if ((degree.get(n.id) ?? 0) >= hubThreshold) return true;
    return false;
  };

  const linkColor = (l: any) => {
    if (highlightedNodes) {
      const s = nodeId(l.source); const t = nodeId(l.target);
      if (highlightedNodes.has(s) && highlightedNodes.has(t)) return palette.edgeHighlight;
      return palette.edgeDim;
    }
    return palette.edgeDefault;
  };
  const linkWidth = (l: any) => {
    const s = nodeId(l.source); const t = nodeId(l.target);
    const isHi = highlightedNodes && highlightedNodes.has(s) && highlightedNodes.has(t);
    return isHi ? 1.6 : 0.6;
  };

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ background: palette.canvas }}>
      {/* KPIs strip at top */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <KPIStrip data={data} />
      </div>

      {/* Floating top bar (search + scope + view mode + canvas + timeline) */}
      <div className="absolute top-[110px] left-0 right-0 z-10 pointer-events-none">
        <GraphFilters stats={{ nodes: visible.nodes.length, links: visible.links.length }} />
      </div>

      {/* Left panel with filters */}
      <LeftFilters data={data} />

      {/* Right-side insights panel */}
      <InsightsPanel data={data} />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm z-0" style={{ color: palette.textPrimary }}>
          Construyendo grafo...
        </div>
      )}

      {!isLoading && visible.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-0">
          <div className="text-center max-w-sm" style={{ color: palette.textPrimary }}>
            <div className="text-5xl mb-3">🧠</div>
            <h3 className="font-semibold mb-1">Tu cerebro operativo está vacío</h3>
            <p className="text-sm text-slate-500">
              Crea temas, responsables y departamentos para que el grafo se construya automáticamente.
            </p>
          </div>
        </div>
      )}

      {viewMode === '3d' && visible.nodes.length > 0 && (
        <ForceGraph3D
          ref={fg3dRef as any}
          graphData={visible as any}
          width={size.width}
          height={size.height}
          backgroundColor={palette.canvas}
          nodeColor={nodeColor}
          nodeVal={(n: any) => {
            const r = nodeSize(n);
            return r * r * 0.35;
          }}
          nodeOpacity={0.92}
          nodeResolution={22}
          nodeRelSize={4}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkOpacity={1}
          linkDirectionalArrowLength={0}
          linkDirectionalParticles={0}
          enableNodeDrag
          enableNavigationControls
          showNavInfo={false}
          onNodeClick={(n: any) => selectNode(n.id)}
          onBackgroundClick={() => selectNode(null)}
          onNodeHover={(n: any) => hoverNode(n?.id ?? null)}
          nodeThreeObjectExtend
          nodeThreeObject={(n: any) => {
            if (!shouldShowLabel(n)) return null as any;
            const sprite = new SpriteText(n.label);
            sprite.color = palette.labelText;
            sprite.textHeight = 3.2;
            sprite.backgroundColor = palette.labelBg;
            sprite.padding = 1.2;
            sprite.borderRadius = 2;
            sprite.fontFace = 'Inter, system-ui, sans-serif';
            sprite.fontWeight = '500';
            (sprite as any).position?.set?.(0, nodeSize(n) + 3.5, 0);
            (sprite as any).renderOrder = 10;
            return sprite;
          }}
          cooldownTicks={160}
          warmupTicks={30}
          d3AlphaDecay={0.03}
          d3VelocityDecay={0.32}
        />
      )}

      {viewMode === '2d' && visible.nodes.length > 0 && (
        <ForceGraph2D
          ref={fg2dRef as any}
          graphData={visible as any}
          width={size.width}
          height={size.height}
          backgroundColor={palette.canvas}
          nodeColor={nodeColor}
          nodeRelSize={4}
          nodeVal={(n: any) => {
            const r = nodeSize(n);
            return r * r * 0.35;
          }}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkDirectionalArrowLength={(l: any) => ((l as WorkGraphEdge).direction === 'bidirectional' ? 0 : 3.5)}
          linkDirectionalArrowRelPos={0.9}
          linkDirectionalParticles={0}
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
          onNodeClick={(n: any) => selectNode(n.id)}
          onBackgroundClick={() => selectNode(null)}
          onNodeHover={(n: any) => hoverNode(n?.id ?? null)}
          nodeCanvasObjectMode={(n: any) => (shouldShowLabel(n) ? 'after' : undefined as any)}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            if (!shouldShowLabel(node)) return;
            const label = String(node.label ?? '');
            if (!label) return;
            const fontSize = 12 / globalScale;
            ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
            const w = ctx.measureText(label).width;
            const padX = 4 / globalScale;
            const padY = 2 / globalScale;
            const h = fontSize + padY * 2;
            const x = node.x - w / 2 - padX;
            const y = node.y + nodeSize(node) / 2 + 3 / globalScale;
            ctx.fillStyle = palette.labelBg;
            ctx.beginPath();
            (ctx as any).roundRect?.(x, y, w + padX * 2, h, 3 / globalScale);
            ctx.fill();
            ctx.textBaseline = 'top';
            ctx.textAlign = 'center';
            ctx.fillStyle = palette.labelText;
            ctx.fillText(label, node.x, y + padY);
          }}
          cooldownTicks={160}
          warmupTicks={30}
          d3AlphaDecay={0.03}
          d3VelocityDecay={0.32}
        />
      )}

      <NodeInspector data={data} />
      <TimelineSlider data={data} />
    </div>
  );
}
