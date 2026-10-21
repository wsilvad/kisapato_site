import Link from "next/link";
import { TrackNotFound } from "@/components/TrackNotFound";

export default function NotFound() {
  return (
    <div className="page narrow">
      <h1 className="page-title">Página não encontrada</h1>
      <p>O endereço que você abriu não existe ou o produto saiu da loja.</p>
      <p>
        <Link href="/" className="btn btn-solid">Voltar ao início</Link> <Link href="/produtos" className="btn btn-outline">Ver produtos</Link>
      </p>
      <TrackNotFound />
    </div>
  );
}
