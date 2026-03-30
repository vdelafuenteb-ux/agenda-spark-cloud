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

    const { token, updates } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ error: "Token requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return new Response(
        JSON.stringify({ error: "No hay actualizaciones para enviar" }),
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
        JSON.stringify({ error: "Token inválido" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tokenData.used) {
      return new Response(
        JSON.stringify({ error: "Ya enviaste tu actualización. Recibirás un nuevo link en el próximo correo." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token expirado" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get valid topic IDs for this assignee
    const { data: validTopics } = await supabase
      .from("topics")
      .select("id")
      .eq("user_id", tokenData.user_id)
      .eq("assignee", tokenData.assignee_name)
      .neq("status", "completado");

    const validTopicIds = new Set((validTopics || []).map((t: any) => t.id));

    let commentsAdded = 0;
    let subtasksToggled = 0;

    for (const update of updates) {
      const { topic_id, comment, subtask_toggles } = update;

      // Only allow updates to valid topics
      if (!validTopicIds.has(topic_id)) continue;

      // Insert comment as progress entry with source='assignee'
      if (comment && typeof comment === "string" && comment.trim()) {
        const { error: entryError } = await supabase
          .from("progress_entries")
          .insert({
            topic_id,
            content: comment.trim(),
            source: "assignee",
          });
        if (!entryError) commentsAdded++;
      }

      // Toggle subtasks
      if (subtask_toggles && Array.isArray(subtask_toggles)) {
        for (const toggle of subtask_toggles) {
          const { id, completed } = toggle;
          if (!id || typeof completed !== "boolean") continue;

          // Verify subtask belongs to this topic
          const { data: subtask } = await supabase
            .from("subtasks")
            .select("id, topic_id")
            .eq("id", id)
            .eq("topic_id", topic_id)
            .single();

          if (subtask) {
            await supabase
              .from("subtasks")
              .update({
                completed,
                completed_at: completed ? new Date().toISOString() : null,
              })
              .eq("id", id);
            subtasksToggled++;
          }
        }
      }
    }

    // Auto-mark recent notification_emails as responded AND confirmed
    // Only confirm emails sent in the last 7 days to avoid corrupting historical data
    if (commentsAdded > 0 || subtasksToggled > 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      await supabase
        .from("notification_emails")
        .update({
          responded: true,
          responded_at: new Date().toISOString(),
          confirmed: true,
          confirmed_at: new Date().toISOString(),
        })
        .eq("user_id", tokenData.user_id)
        .eq("assignee_name", tokenData.assignee_name)
        .eq("confirmed", false)
        .gte("sent_at", sevenDaysAgo.toISOString());
    }

    // Mark token as used so it can't be reused
    await supabase
      .from("update_tokens")
      .update({ used: true })
      .eq("token", token);

    return new Response(
      JSON.stringify({
        success: true,
        comments_added: commentsAdded,
        subtasks_toggled: subtasksToggled,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error submitting update:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
