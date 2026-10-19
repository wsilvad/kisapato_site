import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanPermissions, hasPermission, requiredPermissions } from "../src/lib/permissions.js";

test("Permissões: cada área do painel exige a sua permissão", () => {
  assert.deepEqual(requiredPermissions("GET", "/stats"), ["resumo"]);
  assert.deepEqual(requiredPermissions("GET", "/reports/overview"), ["indicadores"]);
  assert.deepEqual(requiredPermissions("GET", "/reports/inventory"), ["indicadores", "estoque"]);
  assert.deepEqual(requiredPermissions("POST", "/stock/abc/adjust"), ["estoque"]);
  assert.deepEqual(requiredPermissions("PATCH", "/orders/1/status"), ["vendas", "expedicao"]);
  assert.deepEqual(requiredPermissions("PUT", "/settings"), ["conteudo"]);
  assert.deepEqual(requiredPermissions("PUT", "/pages/fale-conosco"), ["paginas"]);
  assert.deepEqual(requiredPermissions("POST", "/users"), ["usuarios"]);
  assert.deepEqual(requiredPermissions("GET", "/campaigns"), ["campanhas"]);
});

test("Permissões: cadastros de consulta abrem para qualquer usuário do painel, mas só editam com a permissão", () => {
  assert.deepEqual(requiredPermissions("GET", "/categories"), []);
  assert.deepEqual(requiredPermissions("POST", "/categories"), ["categorias"]);
  assert.deepEqual(requiredPermissions("PUT", "/products/1"), ["produtos"]);
  assert.deepEqual(requiredPermissions("PATCH", "/brands/1/active"), ["marcas"]);
  assert.deepEqual(requiredPermissions("POST", "/uploads"), []);
  assert.equal(requiredPermissions("GET", "/algo-novo"), null); // rota desconhecida: só acesso total
});

test("Permissões: acesso total vale para tudo e a lista recebida é limpa", () => {
  assert.equal(hasPermission(["*"], "usuarios"), true);
  assert.equal(hasPermission(["produtos"], "usuarios"), false);
  assert.equal(hasPermission(["vendas"], "vendas", "expedicao"), true);
  assert.deepEqual(cleanPermissions(["estoque", "produtos", "inventado", "produtos"]), ["estoque", "produtos"]);
  assert.deepEqual(cleanPermissions(["produtos", "*"]), ["*"]);
});
