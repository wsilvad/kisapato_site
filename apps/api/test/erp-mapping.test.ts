import assert from "node:assert/strict";
import { test } from "node:test";
import type { ErpItem } from "../src/modules/erp/client.js";
import { buildPlan, categoryFor, clampStock, parentName, segmentFor, sizeSchemeFor, titleCase } from "../src/modules/erp/mapping.js";
import { parseXml } from "../src/modules/erp/xml.js";

const item = (over: Partial<ErpItem> = {}): ErpItem => ({
  pkItem: "1.700", description: "TENIS LUZ DA LUA 58650400 PRETO", brandCode: "10000007", type: "TENIS", group: "CALCADO", gender: "FEMININO", color: "PRETO",
  supplierRef: "58650400", siteClass: "NORMAL", price: 479.9, previousPrice: 0, cost: 215.99, note: "",
  sizes: ["34", "35", "36"].map((s) => ({ code: s, label: s, ean: "" })), ...over,
});

test("ERP: nomes em maiúsculas viram título, com acento nos tipos e conectores em minúscula", () => {
  assert.equal(titleCase("TENIS LUZ DA LUA 58650400"), "Tênis Luz da Lua 58650400");
  assert.equal(titleCase("SANDALIA DI VALENTINI 2075A"), "Sandália Di Valentini 2075A");
  assert.equal(parentName(item()), "Tênis Luz da Lua 58650400");
  assert.equal(parentName(item({ description: "BOLSA RAFITTHY 2816149A CAFE", color: "CAFE" })), "Bolsa Rafitthy 2816149A");
});

test("ERP: tipo vira categoria e gênero vira faixa etária + gênero", () => {
  assert.equal(categoryFor("TENIS INFANTIL"), "Tênis");
  assert.equal(categoryFor("CHANEL"), "Chanel");
  assert.equal(categoryFor("PERFUME"), null);
  assert.deepEqual(segmentFor({ gender: "MENINA INFANTIL", type: "SANDALIA" }), { ageGroup: "INFANTIL", gender: "FEMININO" });
  assert.deepEqual(segmentFor({ gender: "MASCULINO", type: "TENIS" }), { ageGroup: "ADULTO", gender: "MASCULINO" });
  assert.equal(segmentFor({ gender: "", type: "TENIS" }), null);
});

test("ERP: tipo de grade e estoque nunca negativo", () => {
  assert.equal(sizeSchemeFor(["34", "35"]), "NUMERACAO");
  assert.equal(sizeSchemeFor(["19/23", "21/23"]), "NUMERACAO");
  assert.equal(sizeSchemeFor(["P", "M", "G"]), "CONFECCAO");
  assert.equal(sizeSchemeFor(["95", "U"]), null);
  assert.equal(clampStock(-2), 0);
  assert.equal(clampStock(3.9), 3);
});

test("ERP: plano do pai agrupa as cores, usa o menor preço e avisa de saldo negativo", () => {
  const plan = buildPlan([
    { item: item({ pkItem: "1.701", description: "TENIS LUZ DA LUA 58650400 NATURAL", color: "NATURAL", price: 0, siteClass: "NONE" }), stock: new Map([["34", 1]]) },
    { item: item(), stock: new Map([["34", 2], ["35", -1]]) },
  ]);
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.colors.map((c) => c.erpItemCode), ["1.700", "1.701"]);
  assert.equal(plan.product.price, 479.9);
  assert.equal(plan.product.active, false);
  assert.equal(plan.colors[0]!.sizes.find((s) => s.label === "35")!.stock, 0);
  assert.equal(plan.colors[0]!.sizes[0]!.sku, "1.700-34");
  assert.ok(plan.warnings.some((w) => /negativo/.test(w)));
});

test("ERP: tipo sem categoria e grade mista impedem a gravação", () => {
  assert.ok(buildPlan([{ item: item({ type: "PERFUME" }), stock: new Map() }]).errors.length > 0);
  assert.ok(buildPlan([{ item: item({ sizes: [{ code: "1", label: "95", ean: "" }, { code: "0", label: "U", ean: "" }] }), stock: new Map() }]).errors.length > 0);
});

test("ERP: grade de confecção (P, M, G, Único) é aceita e o tamanho único vira o rótulo \"Único\"", () => {
  const plan = buildPlan([{ item: item({ type: "BOLSA", sizes: [{ code: "102", label: "P", ean: "" }, { code: "104", label: "G", ean: "" }, { code: "0", label: "U", ean: "" }] }), stock: new Map([["0", 9]]) }]);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.product.sizeScheme, "CONFECCAO");
  assert.deepEqual(plan.colors[0]!.sizes.map((s) => [s.sizeLabel, s.size, s.stock]), [["Único", 0, 9], ["P", 2, 0], ["G", 4, 0]]);
  assert.equal(plan.colors[0]!.sizes[0]!.sku, "1.700-Único");
});

test("ERP: leitor de XML resolve namespaces, listas e entidades", () => {
  const xml = `<?xml version="1.0"?><S:Envelope xmlns:S="x"><S:Body><ns2:r><return><pkItem>1.7</pkItem><descricao>A &amp; B</descricao><t><c>1</c></t><t><c>2</c></t></return></ns2:r></S:Body></S:Envelope>`;
  const body = (parseXml(xml).Envelope as any).Body.r.return;
  assert.equal(body.pkItem, "1.7");
  assert.equal(body.descricao, "A & B");
  assert.equal(body.t.length, 2);
});

test("ERP: o nome do site é tipo + marca, sem referência, e o nome do ERP fica guardado à parte", () => {
  const plan = buildPlan([{ item: item(), stock: new Map() }], { brandName: "Luz da Lua" });
  assert.equal(plan.product.name, "Tênis Luz da Lua");
  assert.equal(plan.product.erpName, "Tênis Luz da Lua 58650400");
  assert.equal(plan.product.slug, "tenis-luz-da-lua-58650400");
  // sem a marca do site, o nome é o do ERP sem a referência
  assert.equal(buildPlan([{ item: item(), stock: new Map() }]).product.name, "Tênis Luz da Lua");
  const kids = buildPlan([{ item: item({ type: "TENIS INFANTIL", description: "TENIS INFANTIL KLIN 199106000 ROSA", color: "ROSA", supplierRef: "199106000", gender: "MENINA INFANTIL" }), stock: new Map() }], { brandName: "Klin" });
  assert.equal(kids.product.name, "Tênis Infantil Klin");
});
