"use client";

import { useState } from "react";
import { Badge, ConfirmButton, EmptyState, ImageField, MoveButtons, Notice, PageHead, Switch, formatDateTime, reorder, toLocalInput, useAdminList } from "@/components/admin/kit";
import { CropEditor } from "@/components/admin/CropEditor";
import { api, assetUrl } from "@/lib/api";
import { cropStyle, desktopCrop, mobileCrop, type Crop } from "@/lib/crop";
import type { Campaign } from "@/types/product";

interface FormState {
  id?: string;
  eyebrow: string;
  title: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  desktopCrop: Crop;
  mobileCrop: Crop;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  active: boolean;
}

const EMPTY: FormState = { eyebrow: "", title: "", body: "", buttonLabel: "", buttonUrl: "", desktopImageUrl: null, mobileImageUrl: null, desktopCrop: desktopCrop(), mobileCrop: mobileCrop(), startsAt: "", endsAt: "", sortOrder: 0, active: true };

const fromCampaign = (c: Campaign): FormState => ({
  id: c.id, eyebrow: c.eyebrow ?? "", title: c.title, body: c.body ?? "", buttonLabel: c.buttonLabel ?? "", buttonUrl: c.buttonUrl ?? "",
  desktopImageUrl: c.desktopImageUrl, mobileImageUrl: c.mobileImageUrl, desktopCrop: desktopCrop(c), mobileCrop: mobileCrop(c), startsAt: toLocalInput(c.startsAt), endsAt: toLocalInput(c.endsAt),
  sortOrder: c.sortOrder, active: c.active,
});

const toBody = (f: FormState) => ({
  eyebrow: f.eyebrow.trim() || null, title: f.title.trim(), body: f.body.trim() || null, buttonLabel: f.buttonLabel.trim() || null,
  buttonUrl: f.buttonUrl.trim() || null, desktopImageUrl: f.desktopImageUrl, mobileImageUrl: f.mobileImageUrl,
  desktopFocusX: f.desktopCrop.x, desktopFocusY: f.desktopCrop.y, desktopZoom: f.desktopCrop.zoom,
  mobileFocusX: f.mobileCrop.x, mobileFocusY: f.mobileCrop.y, mobileZoom: f.mobileCrop.zoom,
  startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null, endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
  sortOrder: f.sortOrder, active: f.active,
});

/** Miniatura no formato do celular (375 × 260), já com o foco e o zoom escolhidos para ele. */
function CampaignThumb({ campaign }: { campaign: Campaign }) {
  // Usa a foto inteira (não a miniatura quadrada), senão o enquadramento não bateria com o do site.
  const src = assetUrl(campaign.mobileImageUrl ?? campaign.desktopImageUrl);
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="thumb-crop">{src && <img src={src} alt="" loading="lazy" style={cropStyle(mobileCrop(campaign))} />}</span>;
}

/** Situação da campanha na loja agora. */
function situation(c: Campaign): { tone: "ok" | "warn" | "off"; label: string } {
  const now = Date.now();
  if (!c.active) return { tone: "off", label: "Desativada" };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { tone: "warn", label: `Agendada para ${formatDateTime(c.startsAt)}` };
  if (c.endsAt && new Date(c.endsAt).getTime() < now) return { tone: "off", label: "Encerrada" };
  return { tone: "ok", label: "No ar" };
}

export default function CampaignsAdmin() {
  const { items, loading, error, setError, reload } = useAdminList<Campaign>("campaigns");
  const [form, setForm] = useState<FormState | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const save = (c: Campaign) => api.admin.update("campaigns", c.id, toBody(fromCampaign(c)));

  if (form) {
    return (
      <CampaignForm
        initial={form}
        onCancel={() => setForm(null)}
        onSaved={async () => {
          setForm(null);
          await reload();
        }}
      />
    );
  }

  return (
    <>
      <PageHead
        title="Campanhas (banners da home)"
        hint="As campanhas no ar se alternam no topo da home, na ordem abaixo. Use o agendamento para programar promoções."
        action={<button className="btn btn-solid btn-sm" onClick={() => setForm({ ...EMPTY, sortOrder: items.length })}>+ Nova campanha</button>}
      />
      <Notice error={error} />
      {loading ? (
        <p>Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState>Nenhuma campanha. Enquanto não houver uma no ar, a home mostra o texto padrão da loja.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Ordem</th><th /><th>Campanha</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {items.map((c, i) => {
                const s = situation(c);
                return (
                  <tr key={c.id} className={s.tone === "off" ? "is-off" : undefined}>
                    <td><MoveButtons index={i} total={items.length} onMove={(d) => run(() => reorder(items, i, d, save))} /></td>
                    <td><CampaignThumb campaign={c} /></td>
                    <td><strong>{c.title}</strong>{c.eyebrow && <><br /><small>{c.eyebrow}</small></>}</td>
                    <td><Badge tone={s.tone}>{s.label}</Badge>{c.endsAt && s.tone === "ok" && <><br /><small>até {formatDateTime(c.endsAt)}</small></>}</td>
                    <td className="row-actions">
                      <button type="button" className="link-btn" onClick={() => setForm(fromCampaign(c))}>Editar</button>
                      <button type="button" className="link-btn" onClick={() => run(() => api.admin.update("campaigns", c.id, { ...toBody(fromCampaign(c)), active: !c.active }))}>{c.active ? "Desativar" : "Ativar"}</button>
                      <ConfirmButton message="Excluir campanha?" onConfirm={() => run(() => api.admin.remove("campaigns", c.id))}>Excluir</ConfirmButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function CampaignForm({ initial, onCancel, onSaved }: { initial: FormState; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setF((cur) => ({ ...cur, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return setError("Informe o título da campanha.");
    if (f.startsAt && f.endsAt && new Date(f.endsAt) <= new Date(f.startsAt)) return setError("O fim da campanha deve ser depois do início.");
    setSaving(true);
    try {
      if (f.id) await api.admin.update("campaigns", f.id, toBody(f));
      else await api.admin.create("campaigns", toBody(f));
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <PageHead title={f.id ? "Editar campanha" : "Nova campanha"} action={<button type="button" className="link-btn" onClick={onCancel}>← Voltar à lista</button>} />
      <fieldset>
        <legend>Texto</legend>
        <label className="span-2">Título<input value={f.title} required onChange={(e) => set("title", e.target.value)} /></label>
        <label className="span-2">Chamada superior (pequena, acima do título)<input value={f.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} placeholder="Nova coleção" /></label>
        <label className="span-2">Texto de apoio<textarea rows={3} value={f.body} onChange={(e) => set("body", e.target.value)} /></label>
        <label>Rótulo do botão<input value={f.buttonLabel} onChange={(e) => set("buttonLabel", e.target.value)} placeholder="Ver coleção" /></label>
        <label>Link do botão<input value={f.buttonUrl} onChange={(e) => set("buttonUrl", e.target.value)} placeholder="/produtos" /></label>
      </fieldset>
      <fieldset>
        <legend>Imagens</legend>
        <ImageField label="Imagem do computador" value={f.desktopImageUrl} onChange={(url) => set("desktopImageUrl", url)} hint="Horizontal, ao menos 1640 × 1160 px." />
        <CropEditor
          title="Enquadramento no computador"
          hint="A foto preenche a área ao lado do texto e é cortada conforme a largura da tela. Escolha o ponto que nunca pode ficar de fora."
          src={f.desktopImageUrl}
          value={f.desktopCrop}
          onChange={(crop) => set("desktopCrop", crop)}
          frames={[{ label: "Notebook 1280", width: 660, height: 580 }, { label: "Desktop 1440", width: 820, height: 580 }, { label: "Tela grande 1920", width: 1300, height: 580 }]}
        />
        <ImageField label="Imagem do celular (opcional)" value={f.mobileImageUrl} onChange={(url) => set("mobileImageUrl", url)} hint="Sem ela, o celular usa a imagem do computador." />
        <CropEditor
          title="Enquadramento no celular"
          hint={f.mobileImageUrl ? "Enquadramento da imagem do celular." : "Sem imagem própria para o celular, é usada a do computador; aqui você escolhe um enquadramento só para o celular."}
          src={f.mobileImageUrl ?? f.desktopImageUrl}
          value={f.mobileCrop}
          onChange={(crop) => set("mobileCrop", crop)}
          frames={[{ label: "Celular 375", width: 375, height: 260 }, { label: "Celular grande 430", width: 430, height: 260 }]}
        />
      </fieldset>
      <fieldset>
        <legend>Publicação</legend>
        <label>Começa em (opcional)<input type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></label>
        <label>Termina em (opcional)<input type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></label>
        <div className="field"><Switch checked={f.active} onChange={(v) => set("active", v)} label={f.active ? "Ativa (respeita as datas)" : "Desativada"} /></div>
      </fieldset>
      <Notice error={error} />
      <div className="form-actions">
        <button className="btn btn-solid btn-sm" disabled={saving}>{saving ? "Salvando…" : "Salvar campanha"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
