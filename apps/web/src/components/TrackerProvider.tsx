"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useEffect } from "react";
import { flush, track } from "@/lib/track";

const VITALS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);

const targetOf = (el: Element) => `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className ? `.${el.className.split(/\s+/)[0]}` : ""}`;

function formErrorType(el: HTMLInputElement): string {
  const v = el.validity;
  if (v.valueMissing) return "vazio";
  if (v.typeMismatch || v.patternMismatch) return "formato";
  if (v.tooShort || v.tooLong || v.rangeUnderflow || v.rangeOverflow) return "tamanho";
  return "invalido";
}

/**
 * Medição automática do site: páginas abertas, erros, velocidade real, cliques repetidos, erros de formulário, imagens quebradas e
 * cliques em banner/story/menu/WhatsApp. Os eventos de produto, sacola e favoritos ficam nos próprios componentes.
 * Não renderiza nada.
 */
export function TrackerProvider() {
  const pathname = usePathname();

  // uma página vista a cada rota nova
  useEffect(() => {
    track("page_view");
  }, [pathname]);

  useReportWebVitals((m) => {
    if (VITALS.has(m.name)) track("web_vital", { value_num: m.value, props: { metric: m.name, rating: m.rating } });
  });

  useEffect(() => {
    let jsErrors = 0;
    const clicks: { t: number; x: number; y: number }[] = [];
    const rageSeen = new Map<Element, number>();

    const onError = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLImageElement) {
        let host = "";
        try {
          host = new URL(t.currentSrc || t.src).host;
        } catch {
          /* sem endereço */
        }
        track("image_error", { props: { src_host: host } });
        return;
      }
      if (e instanceof ErrorEvent && jsErrors++ < 5) track("js_error", { error_code: (e.message || "erro").slice(0, 120), props: { source: (e.filename || "").split("/").pop() ?? "", line: e.lineno } });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (jsErrors++ < 5) track("js_error", { error_code: String((e.reason as Error | undefined)?.message ?? e.reason ?? "promessa rejeitada").slice(0, 120) });
    };
    const onInvalid = (e: Event) => {
      const el = e.target as HTMLInputElement;
      track("form_error", { props: { form: el.form?.id || el.form?.getAttribute("name") || "form", field: el.name || el.id || el.type, type: formErrorType(el) } });
    };
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el?.closest) return;
      // cliques repetidos: 3 ou mais em 1 segundo, perto uns dos outros, no mesmo elemento
      const now = Date.now();
      clicks.push({ t: now, x: e.clientX, y: e.clientY });
      while (clicks.length && now - clicks[0]!.t > 1000) clicks.shift();
      const near = clicks.filter((c) => Math.abs(c.x - e.clientX) < 40 && Math.abs(c.y - e.clientY) < 40);
      if (near.length >= 3 && now - (rageSeen.get(el) ?? 0) > 5000) {
        rageSeen.set(el, now);
        track("rage_click", { props: { target: targetOf(el) } });
      }
      // cliques que valem um evento
      const wa = el.closest("a.wa-float");
      if (wa) return track("whatsapp_click", { props: { origin: "flutuante" } });
      const hero = el.closest<HTMLElement>("a.hero-button");
      if (hero) return track("banner_click", { props: { campaign_id: hero.dataset.trackId ?? "", target: hero.getAttribute("href") ?? "" } });
      const story = el.closest<HTMLElement>("button.story-card");
      if (story) return track("story_open", { props: { story_id: story.dataset.trackId ?? "" } });
      const menu = el.closest<HTMLAnchorElement>('a[role="menuitem"]');
      if (menu) return track("menu_click", { props: { label: (menu.textContent ?? "").trim().slice(0, 40), target: menu.getAttribute("href") ?? "" } });
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  return null;
}
