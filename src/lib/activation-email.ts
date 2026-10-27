// Email di attivazione del Trial: un solo punto di verità per il webhook Stripe
// (primo invio, dopo il pagamento) e per il reinvio (/api/trial/resend-activation).
//
// Nessun import relativo di proposito: testabile direttamente con Node.

export interface ActivationEmailParams {
  /** Nome GIÀ passato da escapeHtml() dal chiamante: viene inserito nell'HTML così com'è. */
  safeName: string;
  /** action_link di Supabase (magic link monouso). */
  link: string;
  /** Pagina da cui chiedere un nuovo link, già con il locale: `${SITE_URL}/${locale}/trial/resend`. */
  resendUrl: string;
  supportEmail: string;
}

export interface ActivationEmail {
  subject: string;
  html: string;
  replyTo: string;
}

export function buildActivationEmail({ safeName, link, resendUrl, supportEmail }: ActivationEmailParams): ActivationEmail {
  return {
    subject: "Il tuo Trial di Job Search Bridge è pronto",
    html:
      `<p>Ciao ${safeName},</p>` +
      `<p>Il pagamento è andato a buon fine: il tuo Trial di 14 giorni è attivo.</p>` +
      `<p><a href="${link}">Clicca qui per accedere al tuo account</a></p>` +
      `<p>Il link è valido per un tempo limitato e usabile una sola volta — se scade, <a href="${resendUrl}">richiedine uno nuovo</a>.</p>` +
      `<hr><p style="font-size:12px;color:#666;">Se hai trovato questa email nella posta indesiderata, segnalala come "non indesiderata": così i prossimi messaggi di Job Search Bridge arriveranno nella posta in arrivo.</p>`,
    replyTo: supportEmail,
  };
}
