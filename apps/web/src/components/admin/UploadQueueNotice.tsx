"use client";

import { useUploadQueueNotice } from "@/lib/upload-queue";

/**
 * Aviso fixo no painel: aparece quando há fotos de outros envios na frente das que estão sendo enviadas aqui, para ficar
 * claro que existe uma fila e que a espera é normal. Some sozinho quando a fila anda.
 */
export function UploadQueueNotice() {
  const { ahead, mine } = useUploadQueueNotice();
  if (ahead <= 0) return null;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <div className="erp-toast upload-toast" role="status" aria-live="polite">
      <p>
        <strong>Fila de fotos</strong>
        <br />
        Há {plural(ahead, "foto", "fotos")} de outros envios na frente
        {mine > 0 ? ` d${mine === 1 ? "a sua" : "as suas"}` : ""}. {mine > 0 ? `${mine === 1 ? "A sua entra" : "As suas entram"} em seguida` : "O seu envio entra em seguida"}: pode continuar aqui, mas não feche esta página.
      </p>
    </div>
  );
}
