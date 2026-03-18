const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIREBASE_EMAIL_URL = "https://us-central1-sistemattransit.cloudfunctions.net/correoAdministracion";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function buildConfirmButton(supabaseUrl: string, notificationIds: string[]): string {
  if (notificationIds.length === 0) return "";
  const confirmUrl = `${supabaseUrl}/functions/v1/mark-email-responded?ids=${notificationIds.join(",")}`;
  return `
    <div style="text-align:center;margin:24px 0;">
      <a href="${confirmUrl}" target="_blank" style="display:inline-block;background-color:#16a34a;color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;">
        ✅ Ya actualicé — Confirmar
      </a>
      <p style="font-size:12px;color:#999;margin-top:8px;">Haz clic para confirmar que ya respondiste sobre estos temas</p>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.99.2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Supabase anon key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to_email, to_name, topics, notification_ids } = await req.json();

    if (!to_email || !topics || !Array.isArray(topics) || topics.length === 0) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: to_email, topics[]" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build consolidated HTML email body
    let mensaje = `<p>Hola ${to_name || ""},</p>`;
    mensaje += `<p><strong>Te recordamos los siguientes temas</strong> para que por favor puedas <strong>responder sobre este correo y actualizar</strong> el estado de cada uno:</p>`;

    topics.forEach((topic: any, index: number) => {
      const pendingSubtasks = (topic.subtasks || []).filter((s: any) => !s.completed);
      mensaje += `<h3 style="margin-bottom:4px;">${index + 1}. ${topic.title}</h3>`;

      if (topic.start_date || topic.due_date) {
        mensaje += `<p style="color:#555;margin:2px 0;">`;
        if (topic.start_date) mensaje += `📅 Inicio: <strong>${formatDate(topic.start_date)}</strong>`;
        if (topic.start_date && topic.due_date) mensaje += ` &nbsp;|&nbsp; `;
        if (topic.due_date) mensaje += `⏰ Vencimiento: <strong>${formatDate(topic.due_date)}</strong>`;
        mensaje += `</p>`;
      }

      if (pendingSubtasks.length > 0) {
        mensaje += `<ul style="margin-top:4px;">`;
        pendingSubtasks.forEach((s: any) => {
          mensaje += `<li>${s.title}`;
          if (s.due_date) mensaje += ` <em>(vence: ${formatDate(s.due_date)})</em>`;
          if (s.notes) mensaje += `<br/><span style="color:#666;font-size:0.9em;">📝 ${s.notes}</span>`;
          mensaje += `</li>`;
        });
        mensaje += `</ul>`;
      } else {
        mensaje += `<p style="margin-left:20px;color:#888;"><em>Sin subtareas pendientes</em></p>`;
      }

      const entries = (topic.progress_entries || []).slice(0, 3);
      if (entries.length > 0) {
        mensaje += `<p style="margin-bottom:2px;"><strong>Bitácora:</strong></p><ul style="color:#555;">`;
        entries.forEach((e: any) => {
          const dateStr = e.created_at ? formatDate(e.created_at) : "";
          mensaje += `<li>${e.content}${dateStr ? ` <em style="color:#999;">(${dateStr})</em>` : ""}</li>`;
        });
        mensaje += `</ul>`;
      }

      mensaje += `<hr style="border:none;border-top:1px solid #eee;margin:12px 0;"/>`;
    });

    // Confirmation button
    const ids = notification_ids || [];
    mensaje += buildConfirmButton(supabaseUrl, ids);

    mensaje += `<p style="font-size:1.1em;"><strong>⚠️ IMPORTANTE: Por favor responde a este correo actualizando sobre CADA UNO de los temas anteriores.</strong></p>`;
    mensaje += `<p style="font-size:1.1em;"><strong>🕐 Plazo máximo de respuesta: 48 HORAS.</strong></p>`;
    mensaje += `<p><strong>No olvides responder a todos</strong> para que tu respuesta llegue a todo el equipo.</p>`;
    mensaje += `<p>Gracias.</p>`;

    const asunto = topics.length === 1
      ? `⚠️ URGENTE: "${topics[0].title}" — Actualizar a la brevedad | 48 hrs para responder`
      : `🚨 ${topics.length} TEMAS ACTIVOS — ¡Actualizar a la brevedad! | Máx. 48 hrs para responder`;

    const CC_EMAILS = ["matias@transitglobalgroup.com", "vicente@transitglobalgroup.com"]
      .filter((cc) => cc.toLowerCase() !== to_email.toLowerCase());

    const response = await fetch(FIREBASE_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ para: to_email, asunto, mensaje, cc: CC_EMAILS }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Firebase email API failed [${response.status}]`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending bulk notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
