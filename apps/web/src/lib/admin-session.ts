/**
 * Sessão do painel, separada da sessão da loja: fica só na aba aberta (sessionStorage), então abrir o
 * /admin numa aba ou janela nova sempre pede login, e entrar na loja como cliente não abre o painel.
 */
const ADMIN_TOKEN_KEY = "ki-sapato:admin-token";

export function getAdminToken(): string | null {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string) {
  try {
    window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    /* sem armazenamento: a sessão vale só até recarregar a página */
  }
}

export function clearAdminToken() {
  try {
    window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* ignora */
  }
}
