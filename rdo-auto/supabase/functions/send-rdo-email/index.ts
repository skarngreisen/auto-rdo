// ============================================================================
// Supabase Edge Function: send-rdo-email
// Deploy with: supabase functions deploy send-rdo-email --no-verify-jwt
//
// Receives: { to: string[], subject: string, filename: string, pdf_base64: string }
// Sends the PDF as an email attachment via Resend.
// Secret: RESEND_API_KEY (set with: npx supabase secrets set RESEND_API_KEY=...)
// ============================================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

interface SendPayload {
  to: string[];
  subject: string;
  filename: string;
  pdf_base64: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let payload: SendPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { to, subject, filename, pdf_base64 } = payload;

  if (!to || !Array.isArray(to) || to.length === 0) {
    return new Response(JSON.stringify({ error: "to[] array required" }), { status: 400 });
  }
  if (!subject || !filename || !pdf_base64) {
    return new Response(JSON.stringify({ error: "subject, filename and pdf_base64 required" }), { status: 400 });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "RDO Auto <onboarding@resend.dev>",
      to,
      subject,
      text: "Segue em anexo o Boletim Diário de Obras (RDO).",
      attachments: [{ filename, content: pdf_base64 }],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return new Response(JSON.stringify({ ok: false, error: data }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: data.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
