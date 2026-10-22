# Upload de fotos: fila e uso de memória

O que acontece quando alguém envia fotos pelo painel (`POST /api/admin/uploads`) e por que existe uma fila.

## Fluxo

1. O painel manda as fotos (até 8 por envio, 15 MB cada) com o cabeçalho `X-Upload-Id`.
2. **Antes de ler o corpo**, a API reserva na memória o `Content-Length` do envio (`MemoryBudget`). Se o total reservado passar de `UPLOAD_QUEUE_MB` (padrão 300), responde `429` "A fila de fotos está cheia agora".
3. Cada foto entra na fila (`ImageQueue`). Só `UPLOAD_CONCURRENCY` fotos (padrão 1) são otimizadas ao mesmo tempo; as outras esperam, em ordem de chegada.
4. A foto é lida **uma vez**: gera a versão principal (até 1600 px, JPEG) e a miniatura sai dela. Imagens estáticas acima de 100 megapixels são recusadas antes de serem lidas.
5. O painel pergunta a `GET /api/admin/uploads/queue?id=<X-Upload-Id>` a cada segundo enquanto envia. Se houver fotos de outros envios na frente, mostra o aviso "Fila de fotos" (canto inferior esquerdo) até a fila andar.

GIF animado segue o mesmo caminho (vira WebP animado). Vídeo de story não passa pela fila: vai direto para o disco.

## Por que 1 foto por vez

Medido com `sharp` 0.35 (Mac, Node 22; o container Linux pode diferir, por isso a folga nas contas). Pico de memória do processo ao otimizar fotos de poucos KB com muitos pixels:

| Entrada | Arquivo | 1 por vez | 2 juntas | 3 juntas |
|---|---|---|---|---|
| WebP 48 MP | 155 KB | 98 MB | 313 MB | 356 MB |
| WebP 100 MP | 323 KB | 107 MB | **533 MB** | 585 MB |
| PNG 100 MP | 2 MB | 134 MB | 209 MB | 286 MB |

Processar duas juntas multiplicou o pico por 3 a 5 no WebP. JPEG de celular não é problema (a leitura já reduz a imagem): 64 a 80 MB mesmo com 48 MP. Antes da mudança, um WebP de 48 MP já chegava a 445 MB, e o limite de pixels do `sharp` era 268 MP.

## Quantas fotos cabem com 2048 MB

Premissas: RAM 2048 MB; API ociosa ~200 MB.

| Item | MB |
|---|---|
| RAM do app | 2048 |
| API ociosa | −200 |
| Reserva para o site, banco, atualização do ERP, coleta de métricas e coletor de lixo (~30% da RAM) | −600 |
| **Sobra para fotos** | **~1250** |
| 1 foto em processamento, pior caso medido (134 MB) com folga 2× para o Linux | −270 |
| **Sobra para fotos esperando na memória** | **~980** |

- **Processadas ao mesmo tempo: 1.** Com 2, o pior caso medido (533 MB) ainda cabe, mas o ganho de velocidade é pequeno e o risco sobe; por isso o padrão é 1.
- **Esperando na fila: até 300 MB de arquivos** (`UPLOAD_QUEUE_MB`), usando só ~30% da sobra. Isso dá **~300 fotos de 1 MB** (o caso normal: cada foto leva ~0,1 s, então a fila esvazia em cerca de 30 s) ou **20 fotos de 15 MB** (o pior caso).
- Pior caso somado: 200 (ocioso) + 300 (esperando) + 270 (processando) ≈ **770 MB**, bem abaixo de 2048 MB. Na máquina antiga de 512 MB o mesmo cenário **não** caberia, e o teto de 300 MB deveria cair para ~60 MB (`UPLOAD_QUEUE_MB=60`).

Acima do teto, o envio é recusado com 429 e o painel mostra a mensagem; nada trava nem cai.

## Ajustes

| Variável | Padrão | Quando mudar |
|---|---|---|
| `UPLOAD_CONCURRENCY` | 1 | Só suba depois de medir no Linux do Discloud (RSS com 2 fotos grandes juntas). |
| `UPLOAD_QUEUE_MB` | 300 | Máquina de 512 MB: 60. Máquina maior: pode subir, mantendo ≤ 40% da "sobra para fotos". |

## O que não foi medido

Os números acima vêm de um Mac. Falta repetir a medição dentro do Discloud (Linux) e confirmar, com envios reais, que o aviso de fila aparece na tela com duas pessoas enviando juntas.
