import { create } from 'zustand';
import type { CanvasMode, WorkEdgeType, WorkNodeType, WorkStatus } from './types';

export type ViewMode = '2d' | '3d';

export type GraphScope = 'global' | 'workspace';

interface GraphStoreState {
  viewMode: ViewMode;
  scope: GraphScope;
  canvasMode: CanvasMode;
  asOf: string | null;
  timelineActive: boolean;
  insightsOpen: boolean;
  leftPanelOpen: boolean;
  selectedNodeId: string | null;
  hoverNodeId: string | null;
  depth: number;
  nodeTypeFilter: Set<WorkNodeType>;
  edgeTypeFilter: Set<WorkEdgeType>;
  statusFilter: Set<WorkStatus>;
  userFilter: string | null;         // user node id
  areaFilter: string | null;         // area node id
  projectFilter: string | null;      // project node id
  clientFilter: string | null;       // client node id
  searchQuery: string;
  showLabels: boolean;

  setViewMode: (m: ViewMode) => void;
  setScope: (s: GraphScope) => void;
  setCanvasMode: (m: CanvasMode) => void;
  setAsOf: (d: string | null) => void;
  setTimelineActive: (b: boolean) => void;
  setInsightsOpen: (b: boolean) => void;
  setLeftPanelOpen: (b: boolean) => void;
  selectNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  setDepth: (n: number) => void;
  toggleNodeType: (t: WorkNodeType) => void;
  toggleEdgeType: (t: WorkEdgeType) => void;
  toggleStatus: (s: WorkStatus) => void;
  setUserFilter: (id: string | null) => void;
  setAreaFilter: (id: string | null) => void;
  setProjectFilter: (id: string | null) => void;
  setClientFilter: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setShowLabels: (b: boolean) => void;
  resetFilters: () => void;
}

const DEFAULT_NODE_TYPES: WorkNodeType[] = [
  'workspace', 'task', 'user', 'area', 'project', 'department', 'milestone', 'deadline',
  'email', 'comment', 'dependency', 'risk', 'blocker', 'client', 'evidence', 'workflow',
];
const DEFAULT_EDGE_TYPES: WorkEdgeType[] = [
  'ASSIGNED_TO', 'CREATED_BY', 'BELONGS_TO_AREA', 'BELONGS_TO_WORKSPACE', 'BELONGS_TO_CLIENT',
  'DEPENDS_ON', 'BLOCKED_BY', 'WAITING_FOR', 'SUPPORTS', 'REQUESTED_HELP_FROM',
  'COLLABORATES_WITH', 'ESCALATED_TO', 'REVIEWED_BY', 'APPROVED_BY', 'COMMENTED_ON',
  'EMAIL_SENT', 'RESPONDED_ON_TIME', 'RESPONDED_LATE', 'COMPLETED_BY', 'COMPLETED',
  'OVERDUE', 'IMPACTS', 'IMPACTS_PROJECT',
];
const DEFAULT_STATUS_FILTER: WorkStatus[] = ['pending', 'active', 'completed', 'overdue', 'blocked', 'risk', 'healthy'];

export const useGraphStore = create<GraphStoreState>((set) => ({
  viewMode: '2d',
  scope: 'global',
  canvasMode: 'light',
  asOf: null,
  timelineActive: false,
  insightsOpen: true,
  leftPanelOpen: true,
  selectedNodeId: null,
  hoverNodeId: null,
  depth: 2,
  nodeTypeFilter: new Set(DEFAULT_NODE_TYPES),
  edgeTypeFilter: new Set(DEFAULT_EDGE_TYPES),
  statusFilter: new Set(DEFAULT_STATUS_FILTER),
  userFilter: null,
  areaFilter: null,
  projectFilter: null,
  clientFilter: null,
  searchQuery: '',
  showLabels: true,

  setViewMode: (m) => set({ viewMode: m }),
  setScope: (s) => set({ scope: s }),
  setCanvasMode: (m) => set({ canvasMode: m }),
  setAsOf: (d) => set({ asOf: d }),
  setTimelineActive: (b) => set({ timelineActive: b, asOf: b ? (new Date()).toISOString() : null }),
  setInsightsOpen: (b) => set({ insightsOpen: b }),
  setLeftPanelOpen: (b) => set({ leftPanelOpen: b }),
  selectNode: (id) => set({ selectedNodeId: id }),
  hoverNode: (id) => set({ hoverNodeId: id }),
  setDepth: (n) => set({ depth: Math.max(0, Math.min(6, n)) }),
  toggleNodeType: (t) => set((s) => {
    const next = new Set(s.nodeTypeFilter);
    next.has(t) ? next.delete(t) : next.add(t);
    return { nodeTypeFilter: next };
  }),
  toggleEdgeType: (t) => set((s) => {
    const next = new Set(s.edgeTypeFilter);
    next.has(t) ? next.delete(t) : next.add(t);
    return { edgeTypeFilter: next };
  }),
  toggleStatus: (st) => set((s) => {
    const next = new Set(s.statusFilter);
    next.has(st) ? next.delete(st) : next.add(st);
    return { statusFilter: next };
  }),
  setUserFilter: (id) => set({ userFilter: id }),
  setAreaFilter: (id) => set({ areaFilter: id }),
  setProjectFilter: (id) => set({ projectFilter: id }),
  setClientFilter: (id) => set({ clientFilter: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setShowLabels: (b) => set({ showLabels: b }),
  resetFilters: () => set({
    nodeTypeFilter: new Set(DEFAULT_NODE_TYPES),
    edgeTypeFilter: new Set(DEFAULT_EDGE_TYPES),
    statusFilter: new Set(DEFAULT_STATUS_FILTER),
    userFilter: null,
    areaFilter: null,
    projectFilter: null,
    clientFilter: null,
    searchQuery: '',
    depth: 2,
  }),
}));
