import assert from "node:assert/strict";
import { test } from "node:test";

// Variáveis mínimas para carregar a configuração (nenhuma conexão com o banco é aberta aqui).
process.env.DATABASE_URL ??= "postgresql://teste:teste@localhost:5432/teste";
process.env.JWT_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres!";
process.env.NODE_ENV = "development";
process.env.ANALYTICS_ENABLED = "false";

const { cleanProps, normalizePath, parseUserAgent, propsOf, redactSearchTerm, deviceFromWidth } = await import("../src/modules/analytics/sanitize.js");
const { occurredAt, rowFromClient } = await import("../src/modules/analytics/ingest.js");
const { EVENTS, EVENT_BY_NAME, TYPED_FIELDS, destinationName } = await import("../src/modules/analytics/registry.js");

const aid = "3f2b8c1e-5a7d-4e6f-9b0a-1c2d3e4f5a6b";
const sid = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ctx = (over: Partial<{ sentAt: number | null }> = {}) => ({ receivedAt: new Date("2026-10-21T15:00:00.000Z"), sentAt: 1_000_000, browser: "Chrome", os: "macOS", ...over });
const base = { anonymous_id: aid, session_id: sid, ts: 1_000_000, viewport_w: 390 };

test("busca: e-mail, CPF e telefone viram [removido] e o termo é cortado em 80", () => {
  assert.equal(redactSearchTerm("tênis branco"), "tênis branco");
  assert.equal(redactSearchTerm("joao@exemplo.com tenis"), "[removido] tenis");
  assert.equal(redactSearchTerm("123.456.789-09"), "[removido]");
  assert.equal(redactSearchTerm("meu fone (11) 91234-5678 bota"), "meu fone [removido] bota");
  assert.equal(redactSearchTerm("x".repeat(200))!.length, 80);
  assert.equal(redactSearchTerm("   "), null);
});

test("caminho: sem endereço do site, parâmetros nem âncora; ids viram :id", () => {
  assert.equal(normalizePath("https://kisapatoloja.discloud.dev/produtos/tenis-luz?cor=preto#topo"), "/produtos/tenis-luz");
  assert.equal(normalizePath("/checkout/3f2b8c1e-5a7d-4e6f-9b0a-1c2d3e4f5a6b"), "/checkout/:id");
  assert.equal(normalizePath("/pedido/123456789/status"), "/pedido/:id/status");
  assert.equal(normalizePath("javascript:alert(1)"), null);
  assert.equal(normalizePath(42), null);
});

test("props: nunca leva e-mail, CPF, senha, nome ou telefone; item_name e cep3 podem", () => {
  const out = propsOf({ email: "a@b.com", cpf: "1", senha: "x", telefone: "1", nome: "Maria", cep: "01310100", item_name: "Tênis", cep3: "013", step: "entrega", nested: { password: "x", ok: 1 } });
  assert.deepEqual(out, { item_name: "Tênis", cep3: "013", step: "entrega", nested: { ok: 1 } });
  assert.deepEqual(propsOf("texto"), {});
  assert.deepEqual(propsOf({ big: "x".repeat(200), list: Array.from({ length: 80 }, (_, i) => i) }).big, "x".repeat(200));
  assert.equal((cleanProps({ list: Array.from({ length: 80 }, (_, i) => i) }) as { list: unknown[] }).list.length, 50);
  assert.deepEqual(propsOf({ a: "x".repeat(200), b: Array.from({ length: 50 }, () => "y".repeat(200)) }), {}, "acima de 4 KB descarta tudo");
});

test("aparelho pela largura e robôs pelo agente de usuário", () => {
  assert.equal(deviceFromWidth(390), "mobile");
  assert.equal(deviceFromWidth(820), "tablet");
  assert.equal(deviceFromWidth(1440), "desktop");
  assert.equal(deviceFromWidth(null), null);
  assert.equal(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605 Version/18.0 Mobile Safari/604").os, "iOS");
  assert.equal(parseUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36").browser, "Chrome");
  assert.equal(parseUserAgent("Googlebot/2.1 (+http://www.google.com/bot.html)").bot, true);
  assert.equal(parseUserAgent("Lighthouse").bot, true);
  assert.equal(parseUserAgent(undefined).bot, true);
});

test("horário: vale a idade do evento no aparelho, não a hora do relógio dele", () => {
  assert.equal(occurredAt(990_000, ctx()).toISOString(), "2026-10-21T14:59:50.000Z");
  assert.equal(occurredAt(1_000_000, ctx()).toISOString(), "2026-10-21T15:00:00.000Z");
  assert.equal(occurredAt(2_000_000, ctx()).toISOString(), "2026-10-21T15:00:00.000Z", "evento do futuro: vale a hora do servidor");
  assert.equal(occurredAt(1_000_000 - 3 * 86_400_000, ctx()).toISOString(), "2026-10-21T15:00:00.000Z", "mais de 48 h: vale a hora do servidor");
  assert.equal(occurredAt(990_000, ctx({ sentAt: null })).toISOString(), "2026-10-21T15:00:00.000Z");
});

test("evento do navegador: aceita o válido e recusa nome fora do registro, evento do servidor, ids ruins e campo obrigatório faltando", () => {
  const ok = rowFromClient({ ...base, event: "product_view", product_id: "p1", price: 349.9, path: "https://loja/produtos/x?y=1", search_term: "ignorado", props: { stock: 4, email: "a@b" } }, ctx());
  assert.ok(ok);
  assert.equal(ok.event, "product_view");
  assert.equal(ok.device_type, "mobile");
  assert.equal(ok.path, "/produtos/x");
  assert.equal(ok.price, 349.9);
  assert.equal(ok.search_term, null, "campo que o evento não declara é ignorado");
  assert.deepEqual(ok.props, { stock: 4 });
  assert.equal(ok.browser, "Chrome");

  assert.equal(rowFromClient({ ...base, event: "purchase", cart_value: 10, items_count: 1 }, ctx()), null, "purchase só o servidor grava");
  assert.equal(rowFromClient({ ...base, event: "evento_inventado" }, ctx()), null);
  assert.equal(rowFromClient({ ...base, event: "page_view", path: "/", anonymous_id: "nao-e-uuid" }, ctx()), null);
  assert.equal(rowFromClient({ ...base, event: "product_view" }, ctx()), null, "sem product_id");
  assert.equal(rowFromClient({ ...base, event: "page_view" }, ctx()), null, "page_view sem caminho");
  assert.equal(rowFromClient("texto", ctx()), null);
});

test("busca no navegador: termo limpo e valores numéricos limitados", () => {
  const row = rowFromClient({ ...base, event: "search", search_term: "fale com maria@x.com", results_count: 12 }, ctx());
  assert.equal(row?.search_term, "fale com [removido]");
  assert.equal(row?.results_count, 12);
  assert.equal(rowFromClient({ ...base, event: "add_to_cart", product_id: "p", variant_id: "v", price: -5, quantity: 1 }, ctx())?.price, null, "preço negativo vira nulo");
});

test("registro: nomes únicos, obrigatórios dentro dos campos e traduções dos eventos de e-commerce", () => {
  assert.equal(new Set(EVENTS.map((e) => e.name)).size, EVENTS.length);
  for (const e of EVENTS) {
    for (const f of e.required ?? []) assert.ok(e.fields.includes(f), `${e.name}: obrigatório ${f} precisa estar nos campos`);
    for (const f of e.fields) assert.ok((TYPED_FIELDS as readonly string[]).includes(f), `${e.name}: campo ${f} desconhecido`);
  }
  assert.equal(destinationName("add_to_cart", "ga4"), "add_to_cart");
  assert.equal(destinationName("product_view", "ga4"), "view_item");
  assert.equal(destinationName("purchase", "segment"), "Order Completed");
  assert.equal(destinationName("rage_click", "posthog"), "$rageclick");
  assert.equal(destinationName("favorite_remove", "ga4"), "favorite_remove", "sem tradução: nome próprio");
  assert.ok(EVENT_BY_NAME.get("purchase")?.serverOnly);
});
