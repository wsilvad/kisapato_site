import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const isProd = env.NODE_ENV === "production";

// Tempos limites: o cadastro espera o envio, então um servidor de e-mail travado não pode prender a resposta por minutos.
const TIMEOUTS = { connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 20_000 };

/** De onde sai o e-mail: SMTP_URL (qualquer provedor) tem prioridade, depois o atalho do Gmail; sem nenhum, só o log (fora de produção). */
export type EmailTransportKind = "smtp-url" | "gmail" | "none";
const emailKind: EmailTransportKind = env.SMTP_URL ? "smtp-url" : env.GMAIL_USER && env.GMAIL_APP_PASSWORD ? "gmail" : "none";

const transport =
  emailKind === "smtp-url"
    ? nodemailer.createTransport({ url: env.SMTP_URL!, ...TIMEOUTS })
    : emailKind === "gmail"
      ? // a senha de app aparece com espaços no Google ("abcd efgh ijkl mnop"); aqui eles são ignorados
        nodemailer.createTransport({ service: "gmail", auth: { user: env.GMAIL_USER!, pass: env.GMAIL_APP_PASSWORD!.replace(/\s+/g, "") }, ...TIMEOUTS })
      : null;

/** Remetente: MAIL_FROM, ou (com o Gmail) o próprio endereço da conta, que é o único que o Gmail aceita como remetente. */
const mailFrom = env.MAIL_FROM ?? (env.GMAIL_USER ? `Ki Sapato <${env.GMAIL_USER}>` : "Ki Sapato <nao-responda@kisapato.com.br>");

/** Resumo (sem segredos) de como o e-mail está configurado, para o comando de teste e para os logs. */
export function emailConfig() {
  return { kind: emailKind, from: mailFrom, user: emailKind === "gmail" ? env.GMAIL_USER : undefined };
}

const twilioReady = env.SMS_DRIVER === "twilio" && Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);

/** E-mail: com SMTP ou Gmail configurado envia de verdade; em desenvolvimento sem nenhum só imprime no log. */
export const emailAvailable = transport !== null || !isProd;
/** SMS: Twilio (com as 3 variáveis) envia de verdade; o driver "console" só vale fora de produção. */
export const smsAvailable = twilioReady || (env.SMS_DRIVER === "console" && !isProd);
/** O cadastro exige confirmar o telefone por SMS? Ver PHONE_VERIFICATION em config/env.ts. */
export const phoneVerificationRequired = env.PHONE_VERIFICATION === "required" || (env.PHONE_VERIFICATION === "auto" && smsAvailable);

export async function sendEmail(to: string, subject: string, text: string) {
  if (!transport) {
    if (isProd) throw new Error("E-mail não configurado (defina SMTP_URL ou GMAIL_USER + GMAIL_APP_PASSWORD)");
    console.log(`[e-mail de desenvolvimento] para ${to}\n  assunto: ${subject}\n  ${text.replace(/\n/g, "\n  ")}`);
    return;
  }
  await transport.sendMail({ from: mailFrom, to, subject, text });
}

/** `toPhone`: só dígitos com o código do país (ex.: 5551999998888). */
export async function sendSms(toPhone: string, text: string) {
  if (twilioReady) {
    const sid = env.TWILIO_ACCOUNT_SID!;
    const from = env.TWILIO_FROM!;
    const body = new URLSearchParams({ To: `+${toPhone}`, Body: text });
    body.set(from.startsWith("MG") ? "MessagingServiceSid" : "From", from);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    // a mensagem de erro da Twilio não traz a credencial; mesmo assim só o status e o código vão para o log
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { code?: number; message?: string } | null;
      throw new Error(`Twilio recusou o SMS (HTTP ${res.status}${detail?.code ? `, código ${detail.code}` : ""})`);
    }
    return;
  }
  if (!smsAvailable) throw new Error("Envio de SMS indisponível");
  console.log(`[SMS de desenvolvimento] para +${toPhone}: ${text}`);
}

/** Texto do código de uso único, igual para e-mail e SMS. */
export function codeMessage(purpose: "PASSWORD_RESET" | "PHONE_VERIFY" | "EMAIL_VERIFY", code: string, minutes: number) {
  const what =
    purpose === "PASSWORD_RESET" ? "redefinir sua senha" : purpose === "EMAIL_VERIFY" ? "confirmar seu e-mail" : "confirmar seu telefone";
  return `Ki Sapato: seu código para ${what} é ${code}. Vale por ${minutes} minutos. Se não foi você, ignore esta mensagem e não compartilhe o código.`;
}
