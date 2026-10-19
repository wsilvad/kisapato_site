import { whatsappUrl } from "@/lib/whatsapp";

/** Ícone do WhatsApp sempre visível no canto inferior direito da loja (some quando não há número cadastrado). */
export function WhatsAppButton({ number }: { number?: string }) {
  const url = whatsappUrl(number);
  if (!url) return null;
  return (
    <a className="wa-float" href={url} target="_blank" rel="noopener noreferrer" aria-label="Fale com a Ki Sapato pelo WhatsApp" title="Fale conosco pelo WhatsApp">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" fill="currentColor">
        <path d="M16.04 3C9.04 3 3.36 8.66 3.36 15.64c0 2.23.59 4.41 1.7 6.33L3.25 28.5l6.7-1.76a12.7 12.7 0 0 0 6.08 1.55h.01c7 0 12.7-5.66 12.7-12.64C28.74 8.66 23.04 3 16.04 3zm0 23.15h-.01a10.53 10.53 0 0 1-5.36-1.47l-.38-.23-3.98 1.04 1.06-3.87-.25-.4a10.43 10.43 0 0 1-1.61-5.58c0-5.8 4.73-10.52 10.54-10.52 2.82 0 5.46 1.1 7.45 3.08a10.43 10.43 0 0 1 3.08 7.44c0 5.8-4.73 10.51-10.54 10.51zm5.78-7.88c-.32-.16-1.87-.92-2.16-1.02-.29-.11-.5-.16-.71.16-.21.32-.82 1.02-1 1.23-.18.21-.37.24-.69.08-.32-.16-1.34-.49-2.55-1.57-.94-.84-1.58-1.87-1.76-2.19-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.98-2.34-.26-.62-.52-.53-.71-.54h-.61c-.21 0-.56.08-.85.4-.29.32-1.11 1.08-1.11 2.64 0 1.56 1.14 3.06 1.3 3.27.16.21 2.24 3.41 5.42 4.78.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.87-.76 2.13-1.5.26-.74.26-1.37.18-1.5-.08-.13-.29-.21-.61-.37z" />
      </svg>
    </a>
  );
}
