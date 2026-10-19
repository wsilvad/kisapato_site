/** Link do WhatsApp da loja (abre a conversa no app ou no WhatsApp Web). Só dígitos com DDI; vazio = sem link. */
export function whatsappUrl(number: string | undefined, text?: string) {
  const digits = (number ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://api.whatsapp.com/send/?phone=%2B${digits}${text ? `&text=${encodeURIComponent(text)}` : ""}`;
}
