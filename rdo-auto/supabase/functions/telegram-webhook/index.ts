// ============================================================================
// Supabase Edge Function: telegram-webhook
// Deploy with: supabase functions deploy telegram-webhook
//
// Handles incoming Telegram messages for @rdoauto_bot.
// On /start <user_id>: links telegram_chat_id to the Supabase profile.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SB_URL = Deno.env.get("SB_URL")!;
const SB_SERVICE_KEY = Deno.env.get("SB_SERVICE_KEY")!;

const sb = createClient(SB_URL, SB_SERVICE_KEY);

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const message = body?.message;
  if (!message || !message.chat || !message.text) {
    return new Response("OK", { status: 200 });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  // Handle /start with optional user_id parameter
  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    const userId = parts[1]; // /start <user_id>

    if (!userId) {
      await sendMessage(chatId,
        "Bem-vindo ao RDO Auto!\n\n" +
        "Use o link enviado pelo seu administrador para vincular a sua conta."
      );
      return new Response("OK", { status: 200 });
    }

    // Link this chat_id to the user's profile
    const { error } = await sb
      .from("profiles")
      .update({ telegram_chat_id: String(chatId) })
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to link user:", error.message);
      await sendMessage(chatId, "Erro ao vincular sua conta. Entre em contato com o administrador.");
      return new Response("OK", { status: 200 });
    }

    // Fetch user name for the welcome message
    const { data: profile } = await sb
      .from("profiles")
      .select("name")
      .eq("user_id", userId)
      .maybeSingle();

    const name = profile?.name || "Usuario";
    await sendMessage(chatId,
      `Olá, ${name}!\n\n` +
      "Sua conta foi vinculada ao RDO Auto. " +
      "Você receberá notificações sobre seus RDOs aqui."
    );

    return new Response("OK", { status: 200 });
  }

  // Unknown command — gentle nudge
  await sendMessage(chatId, "Use o link enviado pelo seu administrador para vincular sua conta ao RDO Auto.");
  return new Response("OK", { status: 200 });
});
