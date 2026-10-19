/** Leitor mínimo de XML para as respostas SOAP do ERP (sem dependência externa): vira objetos simples, sem prefixos de namespace. */
export type XmlValue = string | XmlObject | XmlValue[];
export interface XmlObject {
  [key: string]: XmlValue;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1]!.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });

interface Node {
  name: string;
  children: Node[];
  text: string;
}

export function parseXml(xml: string): XmlObject {
  const root: Node = { name: "#root", children: [], text: "" };
  const stack: Node[] = [root];
  const token = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<\/([^>\s]+)\s*>|<([^\s/>]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = token.exec(xml))) {
    const top = stack[stack.length - 1]!;
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2] !== undefined) {
      if (stack.length > 1) stack.pop();
    } else if (m[3] !== undefined) {
      const node: Node = { name: m[3].replace(/^.*:/, ""), children: [], text: "" };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    } else if (m[6] !== undefined) top.text += decode(m[6]);
  }
  return toObject(root) as XmlObject;
}

function toObject(node: Node): XmlValue {
  if (node.children.length === 0) return node.text.trim();
  const out: XmlObject = {};
  for (const child of node.children) {
    const value = toObject(child);
    const current = out[child.name];
    if (current === undefined) out[child.name] = value;
    else if (Array.isArray(current)) current.push(value);
    else out[child.name] = [current, value];
  }
  return out;
}

/** Um valor que pode vir como item único ou lista (o XML não distingue) sempre como lista. */
export const asArray = <T extends XmlValue>(value: T | T[] | undefined): T[] => (value === undefined ? [] : Array.isArray(value) ? (value as T[]) : [value]);
export const text = (value: XmlValue | undefined): string => (typeof value === "string" ? value : "");
