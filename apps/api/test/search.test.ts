import assert from "node:assert/strict";
import { test } from "node:test";
import { editDistance, normalize, searchDocs, toDoc } from "../src/modules/products/search.js";

const product = (id: string, over: Record<string, unknown> = {}) =>
  toDoc({
    id,
    createdAt: new Date(2026, 9, Number(id.replace(/\D/g, "")) || 1),
    name: "Produto",
    ageGroup: "ADULTO",
    gender: "FEMININO",
    category: { name: "Tênis", productClass: { name: "Calçados" } },
    brand: { name: "Luz da Lua" },
    colors: [],
    variants: [],
    ...over,
  } as never);

const docs = [
  product("p1", { name: "Tênis Luz da Lua", erpName: "Tênis Luz da Lua 58650400", erpRef: "58650400", reference: "58650400", colors: [{ name: "Preto", erpItemCode: "1.700" }, { name: "Bege", erpItemCode: "1.2565" }], variants: [{ color: "Preto", sku: "1.700-34" }] }),
  product("p2", { name: "Sandália Conforto Verão", brand: { name: "Ki Sapato" }, category: { name: "Sandálias", productClass: { name: "Calçados" } }, colors: [{ name: "Caramelo" }] }),
  product("p3", { name: "Bota Couro Trail", brand: { name: "Ki Sapato" }, category: { name: "Botas", productClass: { name: "Calçados" } }, gender: "UNISSEX", colors: [{ name: "Marrom" }] }),
  product("p4", { name: "Sapatênis Casual", brand: { name: "Ferracini" }, category: { name: "Sapatênis", productClass: { name: "Calçados" } }, gender: "MASCULINO", reference: "2075A" }),
];
const find = (q: string) => searchDocs(q, docs);

test("Busca: sem acento e sem diferença de maiúsculas", () => {
  assert.equal(normalize("TÊNIS Luz-da-Lua"), "tenis luz da lua");
  assert.deepEqual(find("tenis").ids[0], "p1");
  assert.equal(find("SANDALIA").ids[0], "p2");
  assert.equal(find("sandália").mode, "exact");
});

test("Busca: por referência, código do item, marca, categoria, cor e público", () => {
  assert.deepEqual(find("58650400").ids, ["p1"]);
  assert.deepEqual(find("1.700").ids, ["p1"]);
  assert.deepEqual(find("2075a").ids, ["p4"]);
  assert.deepEqual(find("ferracini").ids, ["p4"]);
  assert.deepEqual(find("luz da lua").ids, ["p1"]);
  assert.deepEqual(find("luzdalua").ids, ["p1"]);
  assert.deepEqual(find("botas").ids, ["p3"]);
  assert.deepEqual(find("bota marrom").ids, ["p3"]);
  assert.ok(find("masculino").ids.includes("p4"));
  assert.ok(find("masculino").ids.includes("p3")); // unissex aparece nos dois
});

test("Busca: palavra pela metade conta como exata", () => {
  const r = find("sand");
  assert.equal(r.mode, "exact");
  assert.equal(r.ids[0], "p2");
});

test("Busca: com erro de digitação cai para semelhança", () => {
  for (const [q, id] of [["tenys", "p1"], ["sandalha", "p2"], ["ferracinni", "p4"], ["bota marom", "p3"], ["caramleo", "p2"], ["luz da lia", "p1"]] as const) {
    const r = find(q);
    assert.equal(r.mode, "similar", q);
    assert.equal(r.ids[0], id, q);
  }
});

test("Busca: havendo correspondência exata, a semelhança não entra", () => {
  const r = find("bota");
  assert.equal(r.mode, "exact");
  assert.deepEqual(r.ids, ["p3"]); // "botas"/"bota" exata; não traz parecidos como "bege"
});

test("Busca: nada parecido devolve vazio e termos curtos não têm tolerância", () => {
  assert.deepEqual(find("xyzwq").ids, []);
  assert.equal(editDistance("tenis", "tenys", 1), 1);
  assert.equal(editDistance("caramleo", "caramelo", 2), 1); // letras trocadas contam como 1 erro
});
