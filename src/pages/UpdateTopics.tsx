import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, Clock, Loader2, Send, ChevronDown, ChevronUp, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface SubtaskData {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  topic_id: string;
}

interface TopicData {
  id: string;
  title: string;
  due_date: string | null;
  start_date: string | null;
  created_at: string | null;
  status: string;
  is_ongoing: boolean;
  subtasks: SubtaskData[];
  recent_entries: { id: string; content: string; created_at: string; source: string }[];
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function getOverdueDays(dueDate: string | null): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate + "T23:59:59");
  const now = new Date();
  if (now <= due) return 0;
  return Math.ceil((now.getTime() - due.getTime()) / 86400000);
}

export default function UpdateTopics() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigneeName, setAssigneeName] = useState("");
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedTopics, setSavedTopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-update-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error validando token");
        setAssigneeName(data.assignee_name);
        setTopics(data.topics);
        // Initialize toggles with current state
        const initToggles: Record<string, boolean> = {};
        for (const t of data.topics) {
          for (const s of t.subtasks) {
            initToggles[s.id] = s.completed;
          }
        }
        setToggles(initToggles);
        // Start all collapsed
        setExpandedTopics(new Set());
      } catch (err: any) {
        setError(err.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const updates = topics.map((t) => {
        const comment = comments[t.id]?.trim() || "";
        const subtask_toggles = t.subtasks
          .filter((s) => toggles[s.id] !== s.completed)
          .map((s) => ({ id: s.id, completed: toggles[s.id] }));
        return { topic_id: t.id, comment: comment || undefined, subtask_toggles: subtask_toggles.length > 0 ? subtask_toggles : undefined };
      }).filter((u) => u.comment || u.subtask_toggles);

      if (updates.length === 0) {
        setError("No hay cambios para enviar. Escribe al menos un comentario o marca una subtarea.");
        setSubmitting(false);
        return;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error enviando actualización");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-500">Cargando tus temas...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-bold text-slate-800">¡Actualización enviada!</h1>
          <p className="text-slate-500">Tus comentarios y cambios han sido registrados correctamente. Puedes cerrar esta pestaña.</p>
        </div>
      </div>
    );
  }

  const isUsedToken = error?.includes("Ya enviaste");

  if (error && topics.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center space-y-4">
          {isUsedToken ? (
            <>
              <CheckCircle2 className="h-16 w-16 text-amber-500 mx-auto" />
              <h1 className="text-xl font-bold text-slate-800">Link ya utilizado</h1>
              <p className="text-slate-500">Ya enviaste tu actualización con este link. Recibirás un nuevo link en el próximo correo de seguimiento o cuando se te asigne un nuevo tema.</p>
            </>
          ) : (
            <>
              <AlertCircle className="h-16 w-16 text-red-400 mx-auto" />
              <h1 className="text-xl font-bold text-slate-800">Error</h1>
              <p className="text-slate-500">{error}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-800">Actualizar mis temas</h1>
              <p className="text-sm text-slate-500">Hola {assigneeName} — actualiza el estado de tus temas pendientes</p>
            </div>
            {topics.length > 0 && (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                {savedTopics.size} de {topics.length} actualizados
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {topics.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-slate-500">No tienes temas pendientes.</p>
          </div>
        ) : (
          topics.map((topic) => {
            const overdueDays = getOverdueDays(topic.due_date);
            const isOverdue = overdueDays > 0 && !topic.is_ongoing;
            const isExpanded = expandedTopics.has(topic.id);
            const pendingSubtasks = topic.subtasks.filter((s) => !s.completed);
            const isSaved = savedTopics.has(topic.id);
            const hasChanges = !!(comments[topic.id]?.trim()) || topic.subtasks.some((s) => toggles[s.id] !== s.completed);

            return (
              <div
                key={topic.id}
                className={`rounded-xl shadow-sm overflow-hidden transition-all ${
                  isSaved
                    ? "ring-2 ring-emerald-400 bg-emerald-50/40"
                    : isOverdue
                    ? "ring-2 ring-red-300 bg-white"
                    : "ring-1 ring-slate-200 bg-white"
                }`}
              >
                {/* Topic header */}
                <button
                  onClick={() => toggleExpanded(topic.id)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                    isSaved ? "hover:bg-emerald-50/60" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isSaved && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                      <h2 className={`font-semibold text-sm ${
                        isSaved ? "text-emerald-700" : isOverdue ? "text-red-600" : "text-slate-800"
                      }`}>
                        {topic.title}
                      </h2>
                      {isOverdue && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          {overdueDays}d atraso
                        </Badge>
                      )}
                      {isSaved && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">
                          ✓ Guardado
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                      {topic.created_at && (
                        <span>Creado: {formatDate(topic.created_at.slice(0, 10))}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Vence: {formatDate(topic.due_date)}
                      </span>
                      {pendingSubtasks.length > 0 && (
                        <span className="text-amber-600">{pendingSubtasks.length} pendiente{pendingSubtasks.length > 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                    {/* Subtasks */}
                    {topic.subtasks.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Subtareas</p>
                        {topic.subtasks.map((s) => {
                          const sDays = getOverdueDays(s.due_date);
                          return (
                            <label
                              key={s.id}
                              className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                                toggles[s.id] ? "bg-slate-50 opacity-60" : "hover:bg-slate-50"
                              }`}
                            >
                              <Checkbox
                                checked={toggles[s.id] ?? s.completed}
                                onCheckedChange={(checked) =>
                                  setToggles((prev) => ({ ...prev, [s.id]: checked === true }))
                                }
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm ${toggles[s.id] ? "line-through text-slate-400" : "text-slate-700"}`}>
                                  {s.title}
                                </span>
                                {s.due_date && (
                                  <span className={`ml-2 text-xs ${sDays > 0 ? "text-red-500" : "text-slate-400"}`}>
                                    ({formatDate(s.due_date)})
                                  </span>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Recent entries preview */}
                    {topic.recent_entries.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Últimos avances</p>
                        {topic.recent_entries.slice(0, 3).map((e) => (
                          <div key={e.id} className={`text-xs p-2 rounded ${e.source === "assignee" ? "bg-blue-50 text-blue-800" : "bg-slate-50 text-slate-600"}`}>
                            <p className="line-clamp-2">{e.content}</p>
                            <p className="text-[10px] mt-0.5 opacity-60">
                              {new Date(e.created_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              {e.source === "assignee" && " · Tú"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comment textarea */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tu comentario</p>
                      <Textarea
                        value={comments[topic.id] || ""}
                        onChange={(e) => setComments((prev) => ({ ...prev, [topic.id]: e.target.value }))}
                        placeholder="Escribe una actualización sobre este tema..."
                        className="min-h-[80px] text-sm resize-none bg-slate-50 border-slate-200 focus:bg-white"
                      />
                    </div>

                    {/* Save button */}
                    <Button
                      onClick={() => {
                        setSavedTopics((prev) => {
                          const next = new Set(prev);
                          next.add(topic.id);
                          return next;
                        });
                        setExpandedTopics((prev) => {
                          const next = new Set(prev);
                          next.delete(topic.id);
                          return next;
                        });
                      }}
                      disabled={!hasChanges}
                      variant="outline"
                      className={`w-full ${hasChanges ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50" : ""}`}
                      size="sm"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSaved ? "Actualizar comentario" : "Guardar comentario"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Submit button */}
        {topics.length > 0 && (
          <div className="sticky bottom-4">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-12 text-base font-semibold shadow-lg"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Enviar actualización
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
