# Ki Sapato — guia para o Claude

E-commerce de calçados. Idioma: português (pt-BR). Monorepo npm workspaces.

## Estrutura
- `apps/web` — Next.js (App Router) com o layout do protótipo; consome a API. Sessão e sacola no navegador (`src/lib/session.tsx`, `src/lib/cart.tsx`).
- `apps/api` — Express + TypeScript + Prisma (PostgreSQL). Módulos em `src/modules/<nome>`: auth (JWT + bcrypt), products, categories, home, orders (checkout demonstrativo), admin (CRUD), uploads (fotos em disco).
- Banco: PostgreSQL hospedado na Discloud. Migrations em `apps/api/prisma/migrations`.

## Conta do cliente (módulos `auth` e `account` da API; `/auth` e `/conta/*` no web)
- Cadastro com nome completo, CPF (validado, só dígitos, único), e-mail, **celular obrigatório** e senha forte (8+ com letra maiúscula, letra minúscula, número e caractere especial; regras em `src/lib/validation.ts` e `web/src/lib/validators.ts`, mantenha as duas iguais).
- Cadastro em 2 etapas: `POST /auth/register` cria a conta como `pendingVerification` e envia um código de 6 dígitos por e-mail e, se a confirmação do telefone estiver ligada, outro por SMS (sem sessão); `POST /auth/register/verify` confere os códigos juntos (só consome se todos estiverem certos) e abre a sessão. `PHONE_VERIFICATION` (`auto` | `required` | `off`, padrão `auto`) decide se o SMS é exigido: `auto` liga só quando há provedor de SMS, então sem provedor o cadastro pede só o e-mail (o telefone continua obrigatório, mas fica não confirmado: `verifiedPhone` nulo e sem recuperação por SMS) e passa a exigir o SMS sozinho quando o provedor for configurado; `POST /auth/register/resend` reenvia (1 min de intervalo). Login de conta pendente responde 403 `VERIFICATION_REQUIRED`. Conta pendente não reserva e-mail/CPF (um cadastro novo a substitui) e não recupera senha. Sem e-mail configurado (ou com `PHONE_VERIFICATION=required` sem SMS) o cadastro responde 503 (`capabilities.registration=false`). Contas antigas (anteriores à confirmação) seguem entrando normalmente.
- Sessão: JWT com `tv` (= `Profile.tokenVersion`); `requireAuth` consulta o banco, então trocar a senha ou o 2FA derruba as outras sessões. `passwordHash` e `twoFactorSecret` ficam fora das consultas por padrão (`omit` em `src/lib/prisma.ts`).
- 2FA opcional por aplicativo autenticador (TOTP), segredo cifrado com `DATA_ENCRYPTION_KEY`, 10 códigos de emergência (hash). O login com 2FA devolve `{ twoFactorRequired, challenge }`; o painel admin (`AdminLogin`) também trata esse passo.
- Recuperar senha por e-mail ou telefone confirmado: código de 6 dígitos, hash, 15 min, 5 tentativas. E-mail: `GMAIL_USER` + `GMAIL_APP_PASSWORD` (atalho do Gmail, senha de app) ou `SMTP_URL` (qualquer provedor, tem prioridade); teste com `npm run mail:test -w @ki-sapato/api -- destino@exemplo.com`; SMS usa o driver `twilio` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`) ou `console` (só fora de produção). Trocar de provedor = novo driver em `src/lib/notify.ts`.
- Endereços: vários por conta, exatamente um padrão (regra mantida nas rotas). O checkout usa `addressId` e exige CPF na conta (`CPF_REQUIRED`).
- Cartões: só token do gateway + bandeira + 4 últimos dígitos + validade; nunca número nem CVV. Fica desligado até haver gateway (`CARD_PROVIDER`).
- Limites de tentativas em `src/middlewares/rate-limit.ts` (memória do processo; `trust proxy` = 1 em produção).
- Testes: `npm test -w @ki-sapato/api` (regras de segurança, sem banco).

## Comandos
- `npm run dev` (api + web), `npm run typecheck`, `npm run lint`, `npm test -w @ki-sapato/api`.
- `npm run db:migrate` (dev), `npm run db:deploy` (produção), `npm run db:seed`.
- Banco local para testar sem tocar na produção: o `.env` aponta para o banco compartilhado (que é produção); para testes, exporte `DATABASE_URL` e `DIRECT_URL` para um Postgres local descartável antes de rodar migrate/seed/API.

## Regras
- Nunca digitar senhas/segredos em `.env`: o usuário preenche. `.env` não é versionado.
- Admin inicial vem do seed com `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.
- Fotos de produtos ficam em `UPLOAD_DIR` (servidas em `/uploads`); em produção use um diretório persistente e faça backup junto do `pg_dump`.
- Deploy: dois apps na Discloud, `apps/api/discloud.config` (`kisapato-api`) e `apps/web/discloud.config` (`kisapato`). O web precisa de `NEXT_PUBLIC_API_URL` na hora do build.
- Git: push só na branch `pre-prod`, com mensagem de commit completa. Sem commit/push sem o usuário pedir.
- O front gerado no Lovable (TanStack Start + Supabase) foi abandonado; está no histórico (`e142b26`) só como referência.
