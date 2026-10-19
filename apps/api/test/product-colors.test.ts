import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_COLOR_PHOTOS, colorsOf, withColorPhotos, withFirstColorPhotos } from "../src/modules/products/colors.js";

const base = {
  images: ["/uploads/geral-1.jpg"],
  colors: [
    { name: "Caramelo", position: 1, images: ["/uploads/c1.jpg", "/uploads/c2.jpg"] },
    { name: "Preto", position: 0, images: ["/uploads/p1.jpg"] },
  ],
  variants: [{ color: "Caramelo" }, { color: "Preto" }, { color: "Azul" }],
};

test("Fotos por cor: a ordem das cores segue a posição e a primeira abre o produto", () => {
  const colors = colorsOf(base);
  assert.deepEqual(colors.map((c) => c.name), ["Preto", "Caramelo", "Azul"]);
  assert.deepEqual(colors[0]!.images, ["/uploads/p1.jpg"]);
  assert.deepEqual(colors[1]!.images, ["/uploads/c1.jpg", "/uploads/c2.jpg"]);
});

test("Fotos por cor: cor sem fotos usa as fotos gerais; cor só das numerações entra no fim", () => {
  const azul = colorsOf(base).find((c) => c.name === "Azul");
  assert.deepEqual(azul?.images, ["/uploads/geral-1.jpg"]);
});

test("Fotos por cor: a vitrine mostra a foto da primeira cor e não vaza cores nem numerações", () => {
  const card = withFirstColorPhotos({ ...base, id: "x" });
  assert.deepEqual(card.images, ["/uploads/p1.jpg"]);
  assert.equal("colors" in card, false);
  assert.equal("variants" in card, false);
  const page = withColorPhotos({ ...base, id: "x" });
  assert.deepEqual(page.images, ["/uploads/p1.jpg"]);
  assert.equal(page.colors.length, 3);
});

test("Fotos por cor: produto antigo, sem cores cadastradas, continua igual", () => {
  const legacy = withColorPhotos({ images: ["/uploads/a.jpg", "/uploads/b.jpg"], colors: [], variants: [{ color: "Preto" }, { color: "Preto" }, { color: "Marrom" }] });
  assert.deepEqual(legacy.images, ["/uploads/a.jpg", "/uploads/b.jpg"]);
  assert.deepEqual(legacy.colors.map((c) => c.name), ["Preto", "Marrom"]);
  assert.equal(MAX_COLOR_PHOTOS, 4);
});

test("Fotos por cor: o nome da cor não diferencia maiúsculas ao juntar com as numerações", () => {
  const colors = colorsOf({ images: [], colors: [{ name: "Preto", position: 0, images: ["/uploads/p.jpg"] }], variants: [{ color: "preto" }] });
  assert.equal(colors.length, 1);
});
