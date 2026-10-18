import assert from "node:assert/strict";
import { test } from "node:test";

// Variáveis mínimas para carregar a configuração sem depender de um .env (nenhuma conexão com banco é aberta aqui).
process.env.DATABASE_URL ??= "postgresql://teste:teste@localhost:5432/teste";
process.env.JWT_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres!";
process.env.NODE_ENV = "development";
// Twilio de mentira: a configuração é lida uma vez, ao carregar; a chamada de rede é simulada no teste do SMS.
process.env.SMS_DRIVER = "twilio";
process.env.TWILIO_ACCOUNT_SID = "ACtest0000000000000000000000000000";
process.env.TWILIO_AUTH_TOKEN = "token-secreto-de-teste";
process.env.TWILIO_FROM = "+15551234567";
// Gmail de mentira (senha de app com espaços, como o Google mostra): só confere a configuração, nada é enviado.
process.env.GMAIL_USER = "loja.teste@gmail.com";
process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";

const { isValidCpf, normalizePhone, passwordIssues, onlyDigits, maskPhone } = await import("../src/lib/validation.js");
const { decrypt, encrypt, hashCode, normalizeRecoveryCode, randomDigits, randomRecoveryCode, safeEqualHex } = await import("../src/lib/crypto.js");
const { enrollmentFor, newTotpSecret, verifyTotp } = await import("../src/lib/two-factor.js");
const OTPAuth = await import("otpauth");

test("CPF: aceita válidos (com ou sem máscara) e recusa inválidos", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("52998224725"), true);
  assert.equal(isValidCpf("529.982.247-24"), false); // dígito verificador errado
  assert.equal(isValidCpf("111.111.111-11"), false); // sequência repetida
  assert.equal(isValidCpf("1234567890"), false); // curto demais
  assert.equal(isValidCpf(""), false);
  assert.equal(onlyDigits("529.982.247-25"), "52998224725");
});

test("Senha: exige 8+ caracteres com letra, número e caractere especial", () => {
  assert.deepEqual(passwordIssues("Abcdef1!"), []);
  assert.deepEqual(passwordIssues("senha#forte2026"), []);
  assert.ok(passwordIssues("abc1!").some((m) => m.includes("8 caracteres")));
  assert.ok(passwordIssues("abcdefgh1").some((m) => m.includes("especial")));
  assert.ok(passwordIssues("abcdefgh!").some((m) => m.includes("número")));
  assert.ok(passwordIssues("12345678!").some((m) => m.includes("letra")));
  assert.ok(passwordIssues("        ").length >= 3); // só espaços não conta
  assert.ok(passwordIssues("a1!".repeat(30)).some((m) => m.includes("72"))); // limite do bcrypt
  assert.deepEqual(passwordIssues("Pássaro1!"), []); // letras acentuadas valem como letra
});

test("Telefone: normaliza para 55 + DDD + número e recusa inválidos", () => {
  assert.equal(normalizePhone("(51) 99999-8888"), "5551999998888");
  assert.equal(normalizePhone("51999998888"), "5551999998888");
  assert.equal(normalizePhone("+55 51 99999-8888"), "5551999998888");
  assert.equal(normalizePhone("(51) 3333-4444"), "555133334444"); // fixo (10 dígitos)
  assert.equal(normalizePhone("51 89999-8888"), null); // celular sem o 9
  assert.equal(normalizePhone("0199998888"), null); // DDD começando em 0
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("abc"), null);
});

test("Cifra: AES-256-GCM vai e volta, é aleatória e detecta adulteração", () => {
  const secret = "JBSWY3DPEHPK3PXP";
  const a = encrypt(secret);
  const b = encrypt(secret);
  assert.notEqual(a, b); // IV novo a cada vez
  assert.ok(!a.includes(secret));
  assert.equal(decrypt(a), secret);
  const parts = a.split(".");
  parts[3] = Buffer.from("adulterado").toString("base64url");
  assert.throws(() => decrypt(parts.join(".")));
  assert.throws(() => decrypt("lixo"));
});

test("Códigos: numéricos aleatórios, hash estável e comparação em tempo constante", () => {
  const code = randomDigits(6);
  assert.match(code, /^\d{6}$/);
  assert.notEqual(hashCode("123456"), hashCode("123457"));
  assert.equal(hashCode("123456"), hashCode("123456"));
  assert.equal(safeEqualHex(hashCode("a"), hashCode("a")), true);
  assert.equal(safeEqualHex(hashCode("a"), hashCode("b")), false);
  assert.equal(safeEqualHex("zz", "zz"), true); // não-hex não derruba: vira buffer vazio nos dois lados
});

test("Código de emergência: formato XXXXX-XXXXX, sem caracteres ambíguos, e normaliza o que o cliente digita", () => {
  const code = randomRecoveryCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(normalizeRecoveryCode(code.toLowerCase().replace("-", " ")), code);
  assert.equal(normalizeRecoveryCode("abcde12345"), "ABCDE-12345");
  assert.equal(new Set(Array.from({ length: 50 }, randomRecoveryCode)).size, 50);
});

test("2FA TOTP: aceita o código atual e o vizinho, recusa errado e formato inválido", async () => {
  const secret = newTotpSecret();
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30, algorithm: "SHA1" });
  assert.equal(verifyTotp(secret, totp.generate()), true);
  assert.equal(verifyTotp(secret, totp.generate({ timestamp: Date.now() - 30_000 })), true); // 1 intervalo atrás
  assert.equal(verifyTotp(secret, totp.generate({ timestamp: Date.now() - 5 * 60_000 })), false); // 5 minutos atrás
  assert.equal(verifyTotp(secret, "000000" === totp.generate() ? "111111" : "000000"), false);
  assert.equal(verifyTotp(secret, "12345"), false);
  assert.equal(verifyTotp(secret, "abcdef"), false);

  const { otpauthUrl, qrDataUrl } = await enrollmentFor(secret, "cliente@exemplo.com");
  assert.match(otpauthUrl, /^otpauth:\/\/totp\/Ki%20Sapato:cliente%40exemplo\.com\?/);
  assert.ok(otpauthUrl.includes(`secret=${secret}`));
  assert.match(qrDataUrl, /^data:image\/png;base64,/);
});

test("Telefone: máscara mostra só o DDD e os 4 últimos dígitos", () => {
  assert.equal(maskPhone("5551999998888"), "(51) *****-8888");
  assert.equal(maskPhone("555133334444"), "(51) ****-4444");
  assert.equal(maskPhone("123"), "");
});

test("SMS pela Twilio: monta a requisição certa e não vaza a credencial em erros", async () => {
  const { sendSms, smsAvailable, codeMessage } = await import("../src/lib/notify.js");
  assert.equal(smsAvailable, true);

  const calls: { url: string; init: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ sid: "SM1" }), { status: 201 });
    }) as typeof fetch;
    await sendSms("5551999998888", codeMessage("PHONE_VERIFY", "123456", 15));

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "https://api.twilio.com/2010-04-01/Accounts/ACtest0000000000000000000000000000/Messages.json");
    const body = new URLSearchParams(String(calls[0]!.init.body));
    assert.equal(body.get("To"), "+5551999998888");
    assert.equal(body.get("From"), "+15551234567");
    assert.ok(body.get("Body")!.includes("123456"));
    const auth = (calls[0]!.init.headers as Record<string, string>).Authorization;
    assert.equal(Buffer.from(auth.replace("Basic ", ""), "base64").toString(), "ACtest0000000000000000000000000000:token-secreto-de-teste");

    globalThis.fetch = (async () => new Response(JSON.stringify({ code: 21211, message: "Invalid 'To' Phone Number" }), { status: 400 })) as typeof fetch;
    await assert.rejects(
      () => sendSms("5551999998888", "x"),
      (err: Error) => /HTTP 400/.test(err.message) && /21211/.test(err.message) && !err.message.includes("token-secreto-de-teste"),
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("E-mail pelo Gmail: reconhece o atalho, usa a própria conta como remetente e não expõe a senha", async () => {
  const { emailConfig, emailAvailable } = await import("../src/lib/notify.js");
  const cfg = emailConfig();
  assert.equal(cfg.kind, "gmail");
  assert.equal(cfg.user, "loja.teste@gmail.com");
  assert.equal(cfg.from, "Ki Sapato <loja.teste@gmail.com>"); // o Gmail só envia como a própria conta
  assert.equal(emailAvailable, true);
  assert.ok(!JSON.stringify(cfg).includes("abcd")); // o resumo nunca traz a senha
});
