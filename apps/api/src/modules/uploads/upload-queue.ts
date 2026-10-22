import { AppError } from "../../lib/errors.js";

interface Entry {
  owner: string;
  run: () => Promise<void>;
  running: boolean;
}

export interface QueueStatus {
  /** Fotos sendo processadas agora (de qualquer envio). */
  processing: number;
  /** Fotos esperando a vez. */
  waiting: number;
  /** Fotos de OUTROS envios que serão processadas antes das do envio consultado. */
  ahead: number;
  /** Fotos do envio consultado que ainda não terminaram. */
  mine: number;
}

/**
 * Fila das fotos a otimizar. Decodificar uma foto grande é o que mais pesa na memória da API (um WebP de 100 MP chega a
 * centenas de MB), então só `concurrency` fotos processam juntas e as demais esperam, em ordem de chegada. Cada envio
 * (`owner`) é identificado pelo painel, que consulta `status` para avisar o usuário quando há fotos na frente das dele.
 */
export class ImageQueue {
  private readonly entries: Entry[] = [];

  constructor(private readonly concurrency: number) {}

  /** Entra no fim da fila e devolve o resultado quando a foto for processada. */
  run<T>(owner: string, task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.entries.push({
        owner,
        running: false,
        run: () => task().then(resolve, reject),
      });
      this.pump();
    });
  }

  private pump() {
    let running = this.entries.filter((e) => e.running).length;
    for (const entry of this.entries) {
      if (running >= this.concurrency) break;
      if (entry.running) continue;
      entry.running = true;
      running++;
      void entry.run().finally(() => {
        this.entries.splice(this.entries.indexOf(entry), 1);
        this.pump();
      });
    }
  }

  status(owner?: string): QueueStatus {
    const processing = this.entries.filter((e) => e.running).length;
    const firstMine = owner ? this.entries.findIndex((e) => e.owner === owner) : -1;
    const before = firstMine === -1 ? this.entries : this.entries.slice(0, firstMine);
    return {
      processing,
      waiting: this.entries.length - processing,
      ahead: before.filter((e) => e.owner !== owner).length,
      mine: owner ? this.entries.filter((e) => e.owner === owner).length : 0,
    };
  }
}

/**
 * Reserva de memória dos envios. O multer guarda os arquivos inteiros na memória até a foto ser processada; por isso
 * cada envio reserva o seu `Content-Length` antes de ser lido e libera ao terminar. Passou do limite: 429, sem ler o corpo.
 */
export class MemoryBudget {
  private used = 0;

  constructor(private readonly limitBytes: number) {}

  /** Reserva `bytes`; devolve a função que libera. Lança 429 se não couber. */
  reserve(bytes: number): () => void {
    if (this.used + bytes > this.limitBytes) {
      throw new AppError("A fila de fotos está cheia agora. Aguarde alguns instantes e envie de novo.", 429, "UPLOAD_QUEUE_FULL");
    }
    this.used += bytes;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.used -= bytes;
    };
  }

  get inUse() {
    return this.used;
  }
}
