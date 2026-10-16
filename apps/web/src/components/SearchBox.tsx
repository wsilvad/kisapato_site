"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Reconhecimento de voz do navegador (Chrome, Edge, Safari); onde não existe, o microfone nem aparece. */
interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;
const recognitionCtor = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

/** Campo de busca do cabeçalho: digitar ou falar (microfone) leva à lista de produtos com `?busca=`. */
export function SearchBox({ autoFocus, onDone, className }: { autoFocus?: boolean; onDone?: () => void; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Na lista de produtos o campo mostra o termo já buscado.
  const [text, setText] = useState(pathname === "/produtos" ? (params.get("busca") ?? "") : "");
  const [voice, setVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende do navegador; só dá para saber depois de montar
    setVoice(recognitionCtor() !== undefined);
    return () => recognition.current?.stop();
  }, []);

  function search(term: string) {
    const q = term.trim();
    if (!q) return;
    router.push(`/produtos?busca=${encodeURIComponent(q)}`);
    onDone?.();
  }

  function listen() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (listening) return recognition.current?.stop();
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? "";
      setText(heard);
      search(heard);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognition.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <form
      className={`sh-search${className ? ` ${className}` : ""}`}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        search(text);
      }}
    >
      {voice && (
        <button type="button" className={`sh-mic${listening ? " is-listening" : ""}`} aria-label={listening ? "Parar de ouvir" : "Pesquisar por voz"} aria-pressed={listening} onClick={listen}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V22h2v-3.1A7 7 0 0 0 19 12h-2Z" />
          </svg>
        </button>
      )}
      <input type="search" name="q" value={text} placeholder={listening ? "Estou ouvindo…" : "Faça uma pesquisa..."} aria-label="Pesquisar produtos" autoFocus={autoFocus} autoComplete="off" onChange={(e) => setText(e.target.value)} />
      <button type="submit" className="sh-search-go" aria-label="Pesquisar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.500-3.500" />
        </svg>
      </button>
    </form>
  );
}
