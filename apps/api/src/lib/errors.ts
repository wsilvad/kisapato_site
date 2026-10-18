export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    /** Código estável para o front reconhecer o caso sem depender do texto (ex.: "CPF_REQUIRED"). */
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
