import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";

process.env.DATABASE_URL ??= "postgresql://teste:teste@localhost:5432/teste";
process.env.JWT_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres!";
process.env.NODE_ENV = "development";

const { ImageQueue, MemoryBudget } = await import("../src/modules/uploads/upload-queue.js");
const { renderVersions, imageLimitMessage, MAX_PIXELS, MAIN_SIZE, THUMB_SIZE } = await import("../src/modules/uploads/image.js");

const gate = () => {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => (open = resolve));
  return { promise, open };
};

test("fila: só `concurrency` tarefas rodam juntas e a ordem de chegada vale", async () => {
  const queue = new ImageQueue(1);
  const order: string[] = [];
  const first = gate();
  const a = queue.run("a", async () => (order.push("a-inicio"), await first.promise, order.push("a-fim")));
  const b = queue.run("b", async () => void order.push("b"));
  const c = queue.run("c", async () => void order.push("c"));
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(order, ["a-inicio"], "b e c esperam enquanto a processa");
  first.open();
  await Promise.all([a, b, c]);
  assert.deepEqual(order, ["a-inicio", "a-fim", "b", "c"]);
});

test("fila: com concurrency 2, duas rodam juntas e a terceira espera", async () => {
  const queue = new ImageQueue(2);
  const g = gate();
  let running = 0;
  let peak = 0;
  const task = async () => {
    peak = Math.max(peak, ++running);
    await g.promise;
    running--;
  };
  const all = [queue.run("a", task), queue.run("b", task), queue.run("c", task)];
  await new Promise((r) => setImmediate(r));
  assert.equal(peak, 2);
  g.open();
  await Promise.all(all);
});

test("fila: status diz quantas fotos de outros envios estão na frente", async () => {
  const queue = new ImageQueue(1);
  const g = gate();
  const jobs = [
    queue.run("ana", () => g.promise),
    queue.run("ana", () => g.promise),
    queue.run("bia", () => g.promise),
    queue.run("bia", () => g.promise),
  ];
  assert.deepEqual(queue.status("bia"), { processing: 1, waiting: 3, ahead: 2, mine: 2 });
  assert.deepEqual(queue.status("ana"), { processing: 1, waiting: 3, ahead: 0, mine: 2 });
  assert.deepEqual(queue.status("novo"), { processing: 1, waiting: 3, ahead: 4, mine: 0 }, "quem ainda não entrou na fila tem todos à frente");
  g.open();
  await Promise.all(jobs);
  assert.deepEqual(queue.status("bia"), { processing: 0, waiting: 0, ahead: 0, mine: 0 });
});

test("fila: uma tarefa que falha não trava as seguintes", async () => {
  const queue = new ImageQueue(1);
  const bad = queue.run("a", async () => {
    throw new Error("falhou");
  });
  const good = queue.run("a", async () => "ok");
  await assert.rejects(bad, /falhou/);
  assert.equal(await good, "ok");
});

test("memória: recusa com 429 quando passa do teto e libera ao terminar", () => {
  const budget = new MemoryBudget(10);
  const releaseA = budget.reserve(6);
  assert.throws(() => budget.reserve(5), (e: { statusCode?: number; code?: string }) => e.statusCode === 429 && e.code === "UPLOAD_QUEUE_FULL");
  releaseA();
  releaseA(); // liberar duas vezes não devolve a mais
  assert.equal(budget.inUse, 0);
  assert.doesNotThrow(() => budget.reserve(10));
});

const solid = (width: number, height: number, format: "png" | "webp" | "jpeg") =>
  sharp({ create: { width, height, channels: 3, background: "#336699" } })[format]().toBuffer();

test("imagem: foto grande gera versão principal de 1600 px e miniatura quadrada", async () => {
  const { main, thumb } = await renderVersions(await solid(4000, 3000, "jpeg"));
  const m = await sharp(main).metadata();
  const t = await sharp(thumb).metadata();
  assert.equal(Math.max(m.width!, m.height!), MAIN_SIZE);
  assert.deepEqual([t.width, t.height], [THUMB_SIZE, THUMB_SIZE]);
});

test("imagem: foto pequena não é ampliada e WebP/PNG funcionam", async () => {
  for (const format of ["png", "webp"] as const) {
    const { main } = await renderVersions(await solid(800, 600, format));
    const m = await sharp(main).metadata();
    assert.deepEqual([m.width, m.height], [800, 600]);
  }
});

test("imagem: acima do limite de megapixels é recusada com mensagem clara", async () => {
  const side = Math.ceil(Math.sqrt(MAX_PIXELS)) + 10;
  const big = await solid(side, side, "png");
  assert.ok(big.length < 2 * 1024 * 1024, "o arquivo é pequeno mesmo tendo pixels demais");
  await assert.rejects(renderVersions(big), (e) => {
    assert.match(imageLimitMessage(e) ?? "", /grande demais/);
    return true;
  });
  assert.equal(imageLimitMessage(new Error("outra coisa")), null);
});
