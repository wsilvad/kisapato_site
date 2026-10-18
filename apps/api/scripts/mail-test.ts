/**
 * Testa o envio de e-mail com as variáveis do `.env` (SMTP_URL ou GMAIL_USER + GMAIL_APP_PASSWORD), sem subir a API nem tocar no banco.
 *   npm run mail:test -w @ki-sapato/api -- seu@email.com
 */
import { emailConfig, sendEmail } from "../src/lib/notify.js";

const to = process.argv[2];
if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
  console.error("Informe o e-mail de destino: npm run mail:test -w @ki-sapato/api -- seu@email.com");
  process.exit(1);
}

const cfg = emailConfig();
if (cfg.kind === "none") {
  console.error("Nenhum envio de e-mail configurado. Preencha no .env da API: GMAIL_USER + GMAIL_APP_PASSWORD (senha de app do Google) ou SMTP_URL.");
  process.exit(1);
}

console.log(`Enviando por ${cfg.kind === "gmail" ? `Gmail (${cfg.user})` : "SMTP_URL"} como "${cfg.from}" para ${to}…`);

try {
  await sendEmail(to, "Teste de e-mail da Ki Sapato", "Se você recebeu esta mensagem, o envio de e-mail da Ki Sapato está funcionando.\n\nOs códigos de confirmação do cadastro e da recuperação de senha sairão por este mesmo caminho.");
  console.log("Enviado. Confira a caixa de entrada (e a pasta de spam).");
} catch (err) {
  const e = err as { code?: string; responseCode?: number; message?: string };
  console.error(`Falhou: ${e.message ?? err}`);
  if (e.code === "EAUTH" || e.responseCode === 535) {
    console.error("O Gmail recusou o login. Use a SENHA DE APP (Conta Google → Segurança → Senhas de app), e não a senha normal; ela exige a verificação em duas etapas ativa.");
  } else if (e.code === "ETIMEDOUT" || e.code === "ECONNECTION" || e.code === "ESOCKET") {
    console.error("Não foi possível conectar ao servidor de e-mail. Confira a internet e se algum firewall bloqueia as portas 465/587.");
  }
  process.exit(1);
}
