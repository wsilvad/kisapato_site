"use client";

import { useEffect, useState } from "react";
import { PasswordInput } from "@/components/account/PasswordInput";
import { Badge, ConfirmButton, EmptyState, Notice, PageHead, RowOpen, useBackToList } from "@/components/admin/kit";
import { api } from "@/lib/api";
import { FULL_ACCESS, PERMISSION_GROUPS, permissionSummary } from "@/lib/permissions";
import { passwordChecks } from "@/lib/validators";
import type { PanelUser } from "@/types/product";

interface FormState {
  id?: string;
  name: string;
  email: string;
  password: string;
  confirm: string;
  permissions: string[];
}

const EMPTY: FormState = { name: "", email: "", password: "", confirm: "", permissions: [] };
const strong = (password: string) => passwordChecks(password).every((c) => c.ok);

/** Escolha das áreas do painel: "Acesso total" ou área por área, agrupadas como no menu. */
function PermissionPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const total = value.includes(FULL_ACCESS);
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div className="span-2 perm-picker">
      <label className="check perm-total">
        <input type="checkbox" checked={total} onChange={() => onChange(total ? [] : [FULL_ACCESS])} />
        <span><strong>Acesso total</strong> <small>todas as áreas, inclusive as que forem criadas depois</small></span>
      </label>
      <div className="perm-groups">
        {PERMISSION_GROUPS.map((g) => (
          <fieldset key={g.group} className="perm-group" disabled={total}>
            <legend>{g.group}</legend>
            {g.items.map((item) => (
              <label key={item.key} className="check">
                <input type="checkbox" checked={total || value.includes(item.key)} onChange={() => toggle(item.key)} />
                {item.label}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    </div>
  );
}

/**
 * Usuários do painel: quem pode entrar no /admin e em quais áreas. Criar pede nome, e-mail, uma senha inicial (a pessoa
 * pode trocá-la depois) e as permissões. Não exclui ninguém: "Desativar acesso" tira todas as áreas e o login no painel
 * passa a ser recusado.
 */
export default function UsersAdmin() {
  const [users, setUsers] = useState<PanelUser[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  useBackToList(form !== null, () => setForm(null));
  const [newPassword, setNewPassword] = useState({ password: "", confirm: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api.admin.users().then(setUsers).catch((e: Error) => setError(e.message));
  useEffect(() => {
    void load();
    api.adminMe().then((u) => setMe(u.id)).catch(() => undefined);
  }, []);

  const open = (f: FormState) => {
    setForm(f);
    setNewPassword({ password: "", confirm: "" });
    setError("");
    setOk("");
  };
  const edit = (u: PanelUser) => open({ id: u.id, name: u.name ?? "", email: u.email, password: "", confirm: "", permissions: u.permissions });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (form.permissions.length === 0) return setError("Escolha ao menos uma área (ou Acesso total). Para tirar todo o acesso, use “Desativar acesso”.");
    if (!form.id) {
      if (!strong(form.password)) return setError("A senha inicial não cumpre as regras de segurança.");
      if (form.password !== form.confirm) return setError("A confirmação da senha não confere.");
    }
    setSaving(true);
    try {
      if (form.id) await api.admin.updateUser(form.id, { name: form.name.trim(), permissions: form.permissions });
      else await api.admin.createUser({ name: form.name.trim(), email: form.email.trim(), password: form.password, permissions: form.permissions });
      await load();
      setOk(form.id ? "Usuário atualizado." : `Usuário criado. Passe a senha inicial para ${form.name.trim().split(" ")[0]} entrar em /admin.`);
      setForm(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!form?.id) return;
    if (!strong(newPassword.password)) return setError("A nova senha não cumpre as regras de segurança.");
    if (newPassword.password !== newPassword.confirm) return setError("A confirmação da nova senha não confere.");
    setSaving(true);
    try {
      await api.admin.setUserPassword(form.id, newPassword.password);
      setNewPassword({ password: "", confirm: "" });
      setError("");
      setOk("Senha trocada. As sessões abertas desse usuário foram encerradas.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!form?.id) return;
    setSaving(true);
    try {
      await api.admin.updateUser(form.id, { name: form.name.trim(), permissions: [] });
      await load();
      setOk("Acesso ao painel desativado.");
      setForm(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!users) return <><PageHead title="Usuários" /><Notice error={error} />{!error && <p>Carregando…</p>}</>;

  if (form) {
    const editing = Boolean(form.id);
    const self = form.id === me;
    const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch });
    return (
      <form className="admin-form" onSubmit={save}>
        <PageHead title={editing ? `Editar usuário: ${form.name || form.email}` : "Novo usuário do painel"} action={<button type="button" className="link-btn" onClick={() => setForm(null)}>← Voltar à lista</button>} />
        <fieldset>
          <legend>Dados</legend>
          <label>Nome completo<input value={form.name} required maxLength={120} onChange={(e) => set({ name: e.target.value })} /></label>
          <label>E-mail (é o login)
            <input type="email" value={form.email} required disabled={editing} autoComplete="off" onChange={(e) => set({ email: e.target.value })} />
            {editing && <small>O e-mail não muda: para outro e-mail, crie um novo usuário.</small>}
          </label>
          {!editing && (
            <>
              <PasswordInput label="Senha inicial" value={form.password} onChange={(password) => set({ password })} autoComplete="new-password" showChecks />
              <PasswordInput label="Confirme a senha" value={form.confirm} onChange={(confirm) => set({ confirm })} autoComplete="new-password" error={form.confirm && form.confirm !== form.password ? "As senhas não conferem." : undefined} />
              <p className="span-2 field-hint">Combine a senha inicial com a pessoa por um canal seguro. Ela pode ativar a verificação em duas etapas depois.</p>
            </>
          )}
        </fieldset>
        <fieldset>
          <legend>Permissões no painel</legend>
          <p className="span-2 field-hint">Marque as áreas que este usuário pode ver e editar. O menu do painel dele mostra só essas áreas.{self && " Você não pode tirar de si mesmo o acesso a Usuários."}</p>
          <PermissionPicker value={form.permissions} onChange={(permissions) => set({ permissions })} />
        </fieldset>
        {editing && (
          <fieldset>
            <legend>Senha e acesso</legend>
            <PasswordInput label="Nova senha" value={newPassword.password} onChange={(password) => setNewPassword({ ...newPassword, password })} autoComplete="new-password" showChecks />
            <PasswordInput label="Confirme a nova senha" value={newPassword.confirm} onChange={(confirm) => setNewPassword({ ...newPassword, confirm })} autoComplete="new-password" />
            <div className="span-2 form-actions">
              <button type="button" className="btn btn-outline btn-sm" disabled={saving || !newPassword.password} onClick={changePassword}>Trocar senha</button>
              {!self && (
                <ConfirmButton message="Desativar o acesso ao painel deste usuário? Ele não conseguirá mais entrar (dá para reativar depois)." onConfirm={deactivate}>Desativar acesso</ConfirmButton>
              )}
            </div>
          </fieldset>
        )}
        <Notice error={error} ok={ok} />
        <div className="form-actions">
          <button className="btn btn-solid btn-sm" disabled={saving}>{saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar usuário"}</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm(null)}>Cancelar</button>
        </div>
      </form>
    );
  }

  return (
    <>
      <PageHead
        title="Usuários"
        hint="Quem pode entrar no painel e em quais áreas. Cada usuário vê no menu só as áreas liberadas para ele."
        action={<button type="button" className="btn btn-solid btn-sm" onClick={() => open(EMPTY)}>+ Novo usuário</button>}
      />
      <Notice error={error} ok={ok} />
      {users.length === 0 ? (
        <EmptyState>Nenhum usuário do painel.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>E-mail</th><th>Acesso</th><th>2 etapas</th><th /></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const off = u.permissions.length === 0;
                return (
                  <tr key={u.id} className={off ? "is-off" : undefined}>
                    <td><RowOpen label={u.name ?? u.email} onOpen={() => edit(u)}><strong>{u.name ?? "—"}</strong></RowOpen>{u.id === me && <small> (você)</small>}</td>
                    <td>{u.email}</td>
                    <td>{off ? <Badge tone="off">Desativado</Badge> : u.permissions.includes(FULL_ACCESS) ? <Badge tone="ok">Acesso total</Badge> : <small>{permissionSummary(u.permissions)}</small>}</td>
                    <td>{u.twoFactorEnabled ? <Badge tone="ok">Ativa</Badge> : <small>—</small>}</td>
                    <td className="row-actions">
                      <button type="button" className="link-btn" onClick={() => edit(u)}>Editar</button>
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
