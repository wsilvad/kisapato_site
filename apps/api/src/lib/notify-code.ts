import { CODE_MINUTES } from "../modules/auth/codes.js";
import { codeMessage, sendEmail, sendSms } from "./notify.js";

type Purpose = "PASSWORD_RESET" | "PHONE_VERIFY" | "EMAIL_VERIFY";

const EMAIL_SUBJECT: Record<Purpose, string> = {
  PASSWORD_RESET: "Seu código para redefinir a senha",
  PHONE_VERIFY: "Seu código de confirmação",
  EMAIL_VERIFY: "Confirme seu e-mail na Ki Sapato",
};

/** Entrega o código de uso único pelo canal certo (e-mail ou SMS). */
export async function notifyCode(target: { channel: "EMAIL" | "SMS"; destination: string }, purpose: Purpose, code: string) {
  const text = codeMessage(purpose, code, CODE_MINUTES);
  if (target.channel === "EMAIL") await sendEmail(target.destination, EMAIL_SUBJECT[purpose], text);
  else await sendSms(target.destination, text);
}
