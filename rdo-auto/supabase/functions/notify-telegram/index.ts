// ============================================================================
// Supabase Edge Function: notify-telegram
// Deploy with: supabase functions deploy notify-telegram
//
// Bot: @rdoauto_bot (token in .env.local + Supabase secret TELEGRAM_BOT_TOKEN)
// Receives: { user_ids: string[], message: string }
// Looks up telegram_chat_id for each user and sends the message via Telegram Bot API.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SB_URL = Deno.env.get("SB_URL")!;
const SB_SERVICE_KEY = Deno.env.get("SB_SERVICE_KEY")!;

const sb = createClient(SB_URL, SB_SERVICE_KEY);

interface NotifyPayload {
  user_ids: string[];
  message: string;
}

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let payload: NotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { user_ids, message } = payload;

  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return new Response(JSON.stringify({ error: "user_ids array required" }), { status: 400 });
  }
  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "message string required" }), { status: 400 });
  }

  // Look up telegram_chat_id for each user
  const { data: profiles, error } = await sb
    .from("profiles")
    .select("user_id, telegram_chat_id")
    .in("user_id", user_ids);

  if (error) {
    return new Response(JSON.stringify({ error: "DB lookup failed", detail: error.message }), { status: 500 });
  }

  const results: { user_id: string; status: string }[] = [];

  for (const profile of profiles || []) {
    if (!profile.telegram_chat_id) {
      results.push({ user_id: profile.user_id, status: "skipped (no telegram_chat_id)" });
      continue;
    }

    try {
      const tgResp = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: profile.telegram_chat_id,
            text: message,
            parse_mode: "Markdown",
          }),
        }
      );
      const tgData = await tgResp.json();
      results.push({
        user_id: profile.user_id,
        status: tgData.ok ? "sent" : `tg_error: ${JSON.stringify(tgData)}`,
      });
    } catch (e) {
      results.push({ user_id: profile.user_id, status: `fetch_error: ${e.message}` });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
