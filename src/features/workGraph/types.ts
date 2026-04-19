export type WorkNodeType =
  | 'workspace'
  | 'task'
  | 'user'
  | 'area'
  | 'project'
  | 'department'
  | 'milestone'
  | 'deadline'
  | 'email'
  | 'comment'
  | 'dependency'
  | 'risk'
  | 'blocker'
  | 'client'
  | 'evidence'
  | 'workflow';

export type WorkEdgeType =
  | 'ASSIGNED_TO'
  | 'CREATED_BY'
  | 'BELONGS_TO_AREA'
  | 'BELONGS_TO_WORKSPACE'
  | 'BELONGS_TO_CLIENT'
  | 'DEPENDS_ON'
  | 'BLOCKED_BY'
  | 'WAITING_FOR'
  | 'SUPPORTS'
  | 'REQUESTED_HELP_FROM'
  | 'COLLABORATES_WITH'
  | 'ESCALATED_TO'
  | 'REVIEWED_BY'
  | 'APPROVED_BY'
  | 'COMMENTED_ON'
  | 'EMAIL_SENT'
  | 'RESPONDED_ON_TIME'
  | 'RESPONDED_LATE'
  | 'COMPLETED_BY'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'IMPACTS_PROJECT'
  | 'IMPACTS';

export type WorkStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'overdue'
  | 'blocked'
  | 'risk'
  | 'healthy';

export interface WorkGraphNode {
  id: string;
  type: WorkNodeType;
  label: string;
  title?: string;
  subtitle?: string;
  status?: WorkStatus;
  score?: number;
  importance?: number;
  riskLevel?: number;
  ownerId?: string;
  areaId?: string;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkGraphEdge {
  id: string;
  source: string;
  target: string;
  type: WorkEdgeType;
  label?: string;
  strength?: number;
  weight?: number;
  direction?: 'directed' | 'bidirectional';
  status?: WorkStatus;
  reason?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkGraphData {
  nodes: WorkGraphNode[];
  links: WorkGraphEdge[];
}

// ---------- Persisted entities (new collections) ----------

export interface ProjectEntity {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  client_id?: string | null;
  owner_user_id?: string | null;
  created_at: string;
  updated_at?: string;
  archived?: boolean;
}

export interface ClientEntity {
  id: string;
  name: string;
  description?: string | null;
  contact_email?: string | null;
  color?: string | null;
  created_at: string;
  updated_at?: string;
}

/**
 * Persisted manual edge in `task_relationships`. Supports any source/target
 * node type combination (decision: "todo con todo"). `reason` is the
 * free-text explanation the user supplied in the relationship editor.
 */
export interface WorkRelationship {
  id: string;
  source_type: WorkNodeType;
  source_id: string;
  target_type: WorkNodeType;
  target_id: string;
  edge_type: WorkEdgeType;
  reason?: string | null;
  weight?: number | null;
  workspace_id?: string | null;
  created_by?: string | null;
  created_at: string;
}

// ---------- Palettes: light (default) + dark (toggle) ----------

export type CanvasMode = 'light' | 'dark';

export const STATUS_TINT: Record<WorkStatus, string> = {
  pending: '#94a3b8',
  active: '#6366f1',
  completed: '#22c55e',
  overdue: '#f97316',
  blocked: '#ef4444',
  risk: '#eab308',
  healthy: '#22c55e',
};

export const LIGHT_PALETTE = {
  canvas: '#ffffff',
  nodeDefault: '#475569',         // slate-600
  nodeUser: '#22c55e',            // green-500
  nodeWorkspace: '#0f172a',       // slate-900 — anchor
  textPrimary: '#0f172a',
  textOnNode: '#ffffff',
  edgeDefault: 'rgba(71,85,105,0.22)',
  edgeHighlight: '#8b5cf6',
  edgeDim: 'rgba(71,85,105,0.06)',
  labelBg: 'rgba(255,255,255,0.92)',
  labelText: '#0f172a',
} as const;

export const DARK_PALETTE = {
  canvas: '#0d0d0f',
  nodeDefault: '#d4d4d8',
  nodeUser: '#a3e635',
  nodeWorkspace: '#f4f4f5',
  textPrimary: '#e4e4e7',
  textOnNode: '#0d0d0f',
  edgeDefault: 'rgba(212,212,216,0.18)',
  edgeHighlight: '#a78bfa',
  edgeDim: 'rgba(212,212,216,0.05)',
  labelBg: 'rgba(13,13,15,0.82)',
  labelText: '#e4e4e7',
} as const;

export const NODE_COLORS: Record<WorkNodeType, string> = {
  workspace: '#0f172a',
  task: '#6366f1',
  user: '#22c55e',
  area: '#94a3b8',
  project: '#8b5cf6',
  department: '#64748b',
  milestone: '#f59e0b',
  deadline: '#ef4444',
  email: '#06b6d4',
  comment: '#a78bfa',
  dependency: '#6b7280',
  risk: '#f97316',
  blocker: '#dc2626',
  client: '#0ea5e9',
  evidence: '#14b8a6',
  workflow: '#7c3aed',
};

export const EDGE_COLORS: Record<WorkEdgeType, string> = {
  ASSIGNED_TO: '#6366f1',
  CREATED_BY: '#8b5cf6',
  BELONGS_TO_AREA: '#cbd5e1',
  BELONGS_TO_WORKSPACE: '#0f172a',
  BELONGS_TO_CLIENT: '#0ea5e9',
  DEPENDS_ON: '#f59e0b',
  BLOCKED_BY: '#dc2626',
  WAITING_FOR: '#f97316',
  SUPPORTS: '#22c55e',
  REQUESTED_HELP_FROM: '#0ea5e9',
  COLLABORATES_WITH: '#22c55e',
  ESCALATED_TO: '#f97316',
  REVIEWED_BY: '#a78bfa',
  APPROVED_BY: '#22c55e',
  COMMENTED_ON: '#cbd5e1',
  EMAIL_SENT: '#06b6d4',
  RESPONDED_ON_TIME: '#22c55e',
  RESPONDED_LATE: '#ef4444',
  COMPLETED_BY: '#22c55e',
  COMPLETED: '#22c55e',
  OVERDUE: '#f97316',
  IMPACTS: '#8b5cf6',
  IMPACTS_PROJECT: '#8b5cf6',
};

export const EDGE_LABELS: Record<WorkEdgeType, string> = {
  ASSIGNED_TO: 'asignado a',
  CREATED_BY: 'creado por',
  BELONGS_TO_AREA: 'pertenece a',
  BELONGS_TO_WORKSPACE: 'en workspace',
  BELONGS_TO_CLIENT: 'para cliente',
  DEPENDS_ON: 'depende de',
  BLOCKED_BY: 'bloqueado por',
  WAITING_FOR: 'espera a',
  SUPPORTS: 'apoya a',
  REQUESTED_HELP_FROM: 'pidió ayuda a',
  COLLABORATES_WITH: 'colabora con',
  ESCALATED_TO: 'escalado a',
  REVIEWED_BY: 'revisado por',
  APPROVED_BY: 'aprobado por',
  COMMENTED_ON: 'comentó en',
  EMAIL_SENT: 'correo enviado',
  RESPONDED_ON_TIME: 'respondió a tiempo',
  RESPONDED_LATE: 'respondió tarde',
  COMPLETED_BY: 'completado por',
  COMPLETED: 'completada',
  OVERDUE: 'atrasada',
  IMPACTS: 'impacta',
  IMPACTS_PROJECT: 'impacta proyecto',
};

/**
 * Edge types that users can add manually through the RelationshipEditor.
 * Auto-derived edges (ASSIGNED_TO, OVERDUE, COLLABORATES_WITH, etc.) are
 * intentionally excluded — they're computed from state.
 */
export const MANUAL_EDGE_TYPES: WorkEdgeType[] = [
  'DEPENDS_ON',
  'BLOCKED_BY',
  'WAITING_FOR',
  'APPROVED_BY',
  'SUPPORTS',
  'REQUESTED_HELP_FROM',
  'IMPACTS',
  'IMPACTS_PROJECT',
  'BELONGS_TO_CLIENT',
  'REVIEWED_BY',
  'COMMENTED_ON',
  'ESCALATED_TO',
];
