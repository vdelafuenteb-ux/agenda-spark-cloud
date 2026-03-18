const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const ids = url.searchParams.get("ids");

    if (!ids) {
      return new Response(buildHtml("Error", "No se proporcionaron IDs válidos."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const idList = ids.split(",").map(id => id.trim()).filter(Boolean);
    if (idList.length === 0) {
      return new Response(buildHtml("Error", "No se proporcionaron IDs válidos."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.99.2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!serviceRoleKey) {
      return new Response(buildHtml("Error", "Configuración del servidor incompleta."), {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("notification_emails")
      .update({ responded: true, responded_at: now })
      .in("id", idList)
      .eq("responded", false);

    if (error) {
      console.error("Error updating notification_emails:", error);
      return new Response(buildHtml("Error", "No se pudo registrar tu confirmación. Intenta de nuevo."), {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(
      buildHtml(
        "✅ ¡Confirmación recibida!",
        `Se registró tu actualización correctamente (${idList.length} tema${idList.length > 1 ? "s" : ""}).<br/><br/>Gracias por responder. Puedes cerrar esta pestaña.`
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error: unknown) {
    console.error("Error in mark-email-responded:", error);
    return new Response(buildHtml("Error", "Ocurrió un error inesperado."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});

function buildHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8f9fa; color: #333; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { font-size: 16px; color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${body}</p>
  </div>
</body>
</html>`;
}
