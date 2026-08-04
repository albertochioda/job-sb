import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

/**
 * Ponte interno per l'invio email dal worker Python (job-sb-worker), che non
 * ha Resend configurato — solo job-ssb (Node) ce l'ha. Protetto dallo stesso
 * WORKER_SECRET già usato per le chiamate job-ssb → worker (direzione
 * inversa), riusato qui per evitare un secondo segreto condiviso.
 *
 * Non specifico per il canary scraper: qualunque processo lato worker con
 * WORKER_SECRET può inviare una notifica generica tramite questo endpoint.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const expected = process.env.WORKER_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { to, subject, html, text } = await request.json();
  if (!to || !subject || (!html && !text)) {
    return NextResponse.json({ error: "to, subject e html o text sono obbligatori" }, { status: 400 });
  }

  const result = await sendEmail({ to, subject, html, text });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
