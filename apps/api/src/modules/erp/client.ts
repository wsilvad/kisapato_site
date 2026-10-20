import { AppError } from "../../lib/errors.js";
import { asArray, parseXml, text, type XmlObject } from "./xml.js";

/**
 * Cliente das consultas do ERP (Macle ControleWS, SOAP). Só leitura: as operações que gravam (addCliente*, addPedidoSite)
 * ficam de fora de propósito. O endereço vem de `ERP_URL` (ex.: http://host:porta/ControleWS/ControleWS).
 */
export interface ErpSize {
  code: string;
  label: string;
  ean: string;
}

export interface ErpItem {
  pkItem: string;
  description: string;
  brandCode: string;
  type: string;
  group: string;
  gender: string;
  color: string;
  supplierRef: string;
  siteClass: string;
  price: number;
  previousPrice: number;
  cost: number;
  note: string;
  sizes: ErpSize[];
}

function endpoint() {
  const url = process.env.ERP_URL;
  if (!url) throw new AppError("ERP_URL não configurada (endereço do serviço do ERP).", 503);
  return url;
}

/** A atualização pelo painel só precisa saber se há ERP configurado antes de começar. */
export const erpConfigured = () => !!process.env.ERP_URL;

/**
 * Quantas chamadas ao ERP podem estar abertas ao mesmo tempo. Medido em 2026-10-20: com 8 ou mais em paralelo o serviço
 * passa a responder listas VAZIAS (sem erro), o que faria a atualização perder itens e zerar estoque; com até 4 a resposta
 * é sempre a mesma. Vale para todas as chamadas do processo.
 */
const MAX_PARALLEL = 4;
let open = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  // com a fila cheia, espera; quem termina passa a vaga direto para o próximo (sem "open--"), então nunca passa de 4
  if (open >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
  else open++;
  try {
    return await fn();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else open--;
  }
}

function call(operation: string, params: Record<string, string>): Promise<XmlObject[]> {
  return slot(() => request(operation, params));
}

async function request(operation: string, params: Record<string, string>): Promise<XmlObject[]> {
  const body = Object.entries(params).map(([k, v]) => `<${k}>${v.replace(/[<>&]/g, "")}</${k}>`).join("");
  const envelope = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://webservice.macle.com/"><soapenv:Header/><soapenv:Body><web:${operation}>${body}</web:${operation}></soapenv:Body></soapenv:Envelope>`;
  const res = await fetch(endpoint(), { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' }, body: envelope, signal: AbortSignal.timeout(30_000) });
  const xml = await res.text();
  if (!res.ok && !xml.includes("<return")) throw new AppError(`ERP respondeu ${res.status} em ${operation}`, 502);
  const parsed = parseXml(xml);
  const bodyNode = (parsed.Envelope as XmlObject | undefined)?.Body as XmlObject | undefined;
  const response = Object.values(bodyNode ?? {})[0] as XmlObject | undefined;
  return asArray(response && typeof response === "object" ? (response.return as XmlObject | XmlObject[] | undefined) : undefined).filter((r) => typeof r === "object");
}

const num = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function toItem(raw: XmlObject): ErpItem | null {
  const pkItem = text(raw.pkItem);
  if (!pkItem) return null;
  return {
    pkItem,
    description: text(raw.descricao),
    brandCode: text(raw.codMarca),
    type: text(raw.tipoItem),
    group: text(raw.grupoItem),
    gender: text(raw.genero),
    color: text(raw.corItem),
    supplierRef: text(raw.refFornecedor).trim(),
    siteClass: text(raw.classeItemSite),
    price: num(text(raw.precoVendaSite)),
    previousPrice: num(text(raw.precoAnteriorSite)),
    cost: num(text(raw.precoCusto)),
    note: text(raw.obs),
    sizes: asArray(raw.listTamanhoItem as XmlObject | XmlObject[] | undefined).map((t) => ({ code: text(t.codTamanho), label: text(t.descTamanho), ean: text(t.ean) })),
  };
}

/** Dados de um item pelo código "empresa.item" (ex.: 1.2578); null se não existir. Vale para qualquer item, marcado ou não para o site. */
export async function getItem(code: string): Promise<ErpItem | null> {
  const rows = await call("getDadosItemByCod", { codItem: code });
  return rows[0] ? toItem(rows[0]) : null;
}

/** Itens marcados para o site de uma marca (`getDadosItem`): só aparecem os que a loja marcou no ERP, cada cor é um item. */
export async function getSiteItems(brandCode: string): Promise<ErpItem[]> {
  return (await call("getDadosItem", { codMarca: brandCode })).map(toItem).filter((i): i is ErpItem => i !== null);
}

/** Item marcado para o site: a classe do site no ERP (N/P/L/D) é diferente de vazio e de NONE. */
export const isSiteFlagged = (item: Pick<ErpItem, "siteClass">) => item.siteClass !== "" && item.siteClass !== "NONE";

/** Estoque por tamanho (codTamanho → quantidade somada de todas as lojas; o ERP aceita saldo negativo). */
export async function getStock(code: string): Promise<Map<string, number>> {
  let rows = await call("getEstoqueItem", { codItem: code });
  // resposta vazia pode ser "sem estoque" ou o ERP sobrecarregado: confere uma vez antes de zerar o estoque do site
  if (rows.length === 0) rows = await call("getEstoqueItem", { codItem: code });
  const stock = new Map<string, number>();
  for (const r of rows) stock.set(text(r.codTamanho), (stock.get(text(r.codTamanho)) ?? 0) + num(text(r.qtd)));
  return stock;
}

/** Marcas do ERP (codMarca → descrição). */
export async function getBrands(): Promise<{ code: string; name: string }[]> {
  return (await call("getMarcas", {})).map((r) => ({ code: text(r.codMarca), name: text(r.descricao) })).filter((b) => b.code);
}

/**
 * O ERP não tem busca por referência: varre os códigos "empresa.item" em ordem (em lotes paralelos) e devolve os itens que
 * passam no filtro. `onProgress` recebe o último código testado.
 */
export async function findItems(filter: (item: ErpItem) => boolean, { from = 1, to = 3600, company = 1, batch = 12 } = {}): Promise<ErpItem[]> {
  const found: ErpItem[] = [];
  for (let start = from; start <= to; start += batch) {
    const codes = Array.from({ length: Math.min(batch, to - start + 1) }, (_, i) => `${company}.${start + i}`);
    const items = await Promise.all(codes.map((c) => getItem(c).catch(() => null)));
    for (const item of items) if (item && filter(item)) found.push(item);
  }
  return found;
}
