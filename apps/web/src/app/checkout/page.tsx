"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import { AddressForm } from "@/components/account/AddressForm";
import { ApiError, api, type AddressInput } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { useSession } from "@/lib/session";
import { formatCpf, formatZip, isValidCpf, onlyDigits } from "@/lib/validators";
import type { Address } from "@/types/product";

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading, updateUser } = useSession();
  const { lines, total, clear } = useCart();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState("");

  // endereços da conta: o padrão já vem escolhido; "other" é um endereço digitado na hora
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [choice, setChoice] = useState<string>(""); // id do endereço salvo, ou "other"

  // CPF da nota fiscal (contas antigas ainda não têm)
  const [cpf, setCpf] = useState("");
  const [cpfBusy, setCpfBusy] = useState(false);

  // medição: entrou no checkout com itens (uma vez por abertura)
  const began = useRef(false);
  useEffect(() => {
    if (began.current || lines.length === 0) return;
    began.current = true;
    track("begin_checkout", {
      cart_value: total,
      items_count: lines.length,
      props: { items: lines.map((l) => ({ item_id: l.productId ?? l.slug, variant_id: l.variantId, item_name: l.name, price: Number(l.price), quantity: l.quantity })) },
    });
  }, [lines, total]);

  useEffect(() => {
    if (!user) return;
    api.account
      .addresses()
      .then((list) => {
        setAddresses(list);
        setChoice((current) => current || list.find((a) => a.isDefault)?.id || list[0]?.id || "other");
      })
      .catch(() => {
        setAddresses([]);
        setChoice("other");
      });
  }, [user]);

  if (orderId) {
    return (
      <div className="page narrow">
        <h1 className="page-title">Pedido recebido</h1>
        <p>Pedido #{orderId.slice(0, 8)} registrado. Este checkout é demonstrativo: nenhum pagamento foi cobrado.</p>
        <Link href="/conta" className="btn btn-solid">Ver meus pedidos</Link>
      </div>
    );
  }
  if (lines.length === 0) return <div className="page"><p>Sua sacola está vazia. <Link href="/produtos">Ver produtos</Link></p></div>;
  if (loading) return <div className="page"><p>Carregando…</p></div>;
  if (!user) {
    return <div className="page"><p><Link href="/auth?voltar=/checkout">Entre ou cadastre-se</Link> para finalizar a compra.</p></div>;
  }

  const items = lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));

  async function placeOrder(body: { addressId?: string; shippingAddress?: AddressInput; saveAddress?: boolean }) {
    setBusy(true);
    setError("");
    try {
      const order = await api.createOrder({
        items,
        addressId: body.addressId,
        shippingAddress: body.shippingAddress && {
          recipient: body.shippingAddress.recipient,
          zip: body.shippingAddress.zip,
          street: body.shippingAddress.street,
          number: body.shippingAddress.number,
          complement: body.shippingAddress.complement,
          district: body.shippingAddress.district,
          city: body.shippingAddress.city,
          state: body.shippingAddress.state,
        },
        saveAddress: body.saveAddress,
      });
      clear();
      setOrderId(order.id);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === "CPF_REQUIRED") {
        updateUser({ ...user!, cpf: null }); // a conta não tem CPF: mostra o campo abaixo
        setError("Informe o seu CPF para continuar.");
      } else {
        setError(err instanceof Error ? err.message : "Não foi possível concluir o pedido");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveCpf(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValidCpf(cpf)) return setError("CPF inválido. Confira os números.");
    setCpfBusy(true);
    setError("");
    try {
      updateUser(await api.account.updateProfile({ name: user?.name ?? "", cpf: onlyDigits(cpf), phone: user?.phone ?? undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o CPF");
    } finally {
      setCpfBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <h1 className="page-title">Finalizar compra</h1>

      {!user.cpf && (
        <form className="form" onSubmit={saveCpf} noValidate>
          <label>CPF<input value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} required inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" /></label>
          <button className="btn btn-outline btn-sm" disabled={cpfBusy}>{cpfBusy ? "Salvando…" : "Salvar CPF"}</button>
        </form>
      )}

      <h2 className="checkout-step">Endereço de entrega</h2>
      {addresses === null ? <p>Carregando seus endereços…</p> : (
        <>
          {addresses.length > 0 && (
            <ul className="address-list" role="radiogroup" aria-label="Endereço de entrega">
              {addresses.map((a) => (
                <li key={a.id} className={`address-card${choice === a.id ? " is-selected" : ""}`}>
                  <label className="address-pick">
                    <input type="radio" name="address" value={a.id} checked={choice === a.id} onChange={() => setChoice(a.id)} />
                    <span>
                      <strong>{a.label || "Endereço"}</strong>{a.isDefault && <span className="tag-default">Padrão</span>}
                      <br />{a.recipient}<br />
                      {a.street}, {a.number}{a.complement ? ` · ${a.complement}` : ""} · {a.district}<br />
                      {a.city}/{a.state} · CEP {formatZip(a.zip)}
                    </span>
                  </label>
                </li>
              ))}
              <li className={`address-card${choice === "other" ? " is-selected" : ""}`}>
                <label className="address-pick">
                  <input type="radio" name="address" value="other" checked={choice === "other"} onChange={() => setChoice("other")} />
                  <span><strong>Entregar em outro endereço</strong></span>
                </label>
              </li>
            </ul>
          )}

          {choice === "other" ? (
            <AddressForm
              askDefault={false}
              askSave
              defaultRecipient={user.name ?? ""}
              submitLabel={busy ? "Enviando…" : "Confirmar pedido"}
              onSubmit={(data, { save }) => placeOrder({ shippingAddress: data, saveAddress: save })}
            />
          ) : (
            <div className="form">
              <p><strong>Total: {formatPrice(total)}</strong></p>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="btn btn-solid" disabled={busy || !choice || !user.cpf} onClick={() => placeOrder({ addressId: choice })}>{busy ? "Enviando…" : "Confirmar pedido"}</button>
              <p><Link href="/conta/enderecos" className="link-btn">Gerenciar meus endereços</Link></p>
            </div>
          )}
          {choice === "other" && <p><strong>Total: {formatPrice(total)}</strong></p>}
          {choice === "other" && error && <p className="form-error" role="alert">{error}</p>}
        </>
      )}
    </div>
  );
}
