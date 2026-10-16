/** Limite de envio (igual ao da API): vídeo, GIF ou foto, até 15 MB. */
export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

/** O endereço guardado aponta para um vídeo (mp4, webm, mov)? O resto é tratado como imagem (foto ou GIF animado). */
export const isVideoUrl = (url: string | null | undefined) => !!url && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
