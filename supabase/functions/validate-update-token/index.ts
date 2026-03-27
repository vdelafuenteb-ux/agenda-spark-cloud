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
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.99.2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ error: "Token requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("update_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Token inválido o no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token expirado. Solicita un nuevo correo." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch topics for this assignee (not completed)
    const { data: topics, error: topicsError } = await supabase
      .from("topics")
      .select("id, title, due_date, start_date, created_at, status, is_ongoing, assignee")
      .eq("user_id", tokenData.user_id)
      .eq("assignee", tokenData.assignee_name)
      .in("status", ["activo", "seguimiento"]);

    if (topicsError) throw topicsError;

    // Fetch subtasks for those topics
    const topicIds = (topics || []).map((t: any) => t.id);
    let subtasks: any[] = [];
    let progressEntries: any[] = [];

    if (topicIds.length > 0) {
      const [subtasksRes, entriesRes] = await Promise.all([
        supabase
          .from("subtasks")
          .select("id, title, completed, due_date, topic_id, sort_order")
          .in("topic_id", topicIds)
          .order("sort_order", { ascending: true }),
        supabase
          .from("progress_entries")
          .select("id, content, created_at, topic_id, source")
          .in("topic_id", topicIds)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      subtasks = subtasksRes.data || [];
      progressEntries = entriesRes.data || [];
    }

    // Group by topic
    const result = (topics || []).map((t: any) => ({
      ...t,
      subtasks: subtasks.filter((s: any) => s.topic_id === t.id),
      recent_entries: progressEntries.filter((e: any) => e.topic_id === t.id).slice(0, 5),
    }));

    return new Response(
      JSON.stringify({
        assignee_name: tokenData.assignee_name,
        topics: result,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error validating token:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
