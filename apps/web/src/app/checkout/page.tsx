"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { useSession } from "@/lib/session";

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const { lines, total, clear } = useCart();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState("");

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
    return <div className="page"><p><Link href="/auth">Entre ou cadastre-se</Link> para finalizar a compra.</p></div>;
  }

  async function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    setError("");
    try {
      const order = await api.createOrder({
        items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        shippingAddress: {
          recipient: f.recipient!, zip: f.zip!, street: f.street!, number: f.number!,
          complement: f.complement || undefined, district: f.district!, city: f.city!, state: f.state!.toUpperCase(),
        },
      });
      clear();
      setOrderId(order.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir o pedido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <h1 className="page-title">Finalizar compra</h1>
      <form className="form" onSubmit={onSubmit}>
        <label>Destinatário<input name="recipient" required defaultValue={user.name ?? ""} /></label>
        <label>CEP<input name="zip" required minLength={8} inputMode="numeric" autoComplete="postal-code" /></label>
        <label>Rua<input name="street" required autoComplete="address-line1" /></label>
        <label>Número<input name="number" required /></label>
        <label>Complemento<input name="complement" /></label>
        <label>Bairro<input name="district" required /></label>
        <label>Cidade<input name="city" required /></label>
        <label>UF<input name="state" required maxLength={2} /></label>
        <p><strong>Total: {formatPrice(total)}</strong></p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-solid" disabled={busy}>Confirmar pedido</button>
      </form>
    </div>
  );
}
