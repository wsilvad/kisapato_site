import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(process.env.NODE_ENV === "production" ? 8080 : 3333),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET precisa de ao menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  /** Pasta onde as fotos enviadas pelo admin são gravadas (na Discloud, um caminho dentro do app). */
  UPLOAD_DIR: z.string().default("uploads"),
  /**
   * Chave (32 bytes em base64) que cifra o segredo da verificação em duas etapas no banco. Gere com
   * `openssl rand -base64 32` e guarde só nas variáveis do servidor. Em desenvolvimento, se faltar, deriva do JWT_SECRET;
   * em produção, sem ela a verificação em duas etapas fica indisponível.
   */
  DATA_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine((v) => !v || Buffer.from(v, "base64").length === 32, "DATA_ENCRYPTION_KEY precisa ter 32 bytes em base64"),
  /** Quantos proxies confiáveis ficam na frente da API (a Discloud usa 1); define o IP lido pelo limitador de tentativas. */
  TRUST_PROXY: z.coerce.number().int().min(0).optional(),
  /** Envio de e-mail (recuperar senha): URL SMTP, ex.: smtps://usuario:senha@smtp.exemplo.com:465. Sem ela, o e-mail fica indisponível. */
  SMTP_URL: z.string().optional(),
  /**
   * Atalho para enviar pelo Gmail: o endereço da conta e uma SENHA DE APP (Conta Google → Segurança → Senhas de app, exige a
   * verificação em duas etapas). Os espaços da senha são ignorados. Se SMTP_URL também existir, ela tem prioridade.
   */
  GMAIL_USER: z.email().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  /** Remetente exibido. Sem ele, usa o GMAIL_USER (o Gmail só envia como a própria conta). */
  MAIL_FROM: z.string().optional(),
  /**
   * Envio de SMS. "twilio" envia de verdade (exige TWILIO_*); "console" só fora de produção e imprime o código no log.
   * Sem driver, a confirmação do telefone por SMS fica desligada (ver PHONE_VERIFICATION).
   */
  SMS_DRIVER: z.enum(["console", "twilio"]).optional(),
  /**
   * Confirmação do telefone por SMS no cadastro. "auto" (padrão): liga sozinha quando houver provedor de SMS configurado e
   * fica desligada enquanto não houver (o cadastro pede só o código do e-mail). "required": sempre exige (sem SMS, o cadastro
   * fica indisponível). "off": nunca exige. O telefone continua obrigatório no cadastro nos três casos.
   */
  PHONE_VERIFICATION: z.enum(["auto", "required", "off"]).default("auto"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  /** Número de origem (E.164, ex.: +15551234567) ou o SID de um Messaging Service (começa com "MG"). */
  TWILIO_FROM: z.string().optional(),
  /** Gateway que tokeniza cartões (ex.: "mercadopago"). Sem ele, salvar cartão fica indisponível. */
  CARD_PROVIDER: z.string().optional(),
  /** Medição do site (eventos de navegação, sacola, erros…). "false" desliga a gravação e a manutenção (ver docs/analytics). */
  ANALYTICS_ENABLED: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  /** Liga o visitante anônimo ao cliente logado (tabela analytics.identities). Desligado por padrão: decisão de privacidade. */
  ANALYTICS_IDENTIFY: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  /** Meses de eventos brutos guardados; partições mais antigas são removidas na manutenção diária. */
  ANALYTICS_RETENTION_MONTHS: z.coerce.number().int().min(3).max(60).default(13),
  /** Chave da API de métricas (GET /api/metrics/v1/*). Sem ela, a API de métricas fica desligada. Gere uma aleatória longa e guarde só no servidor. */
  METRICS_API_KEY: z.string().min(24, "METRICS_API_KEY precisa ter ao menos 24 caracteres").optional(),
  /** Conexão SOMENTE LEITURA (usuário bi_reader) usada pela API de métricas e pelo servidor MCP. Sem ela, usam a conexão principal limitada ao esquema bi. */
  METRICS_DATABASE_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
