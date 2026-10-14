import { Router } from "express";
import { z } from "zod";
import { quoteShipping } from "./shipping.service.js";

export const shippingRouter = Router();

/** Frete e prazo por CEP. `subtotal` (R$) vale para o frete grátis; sem ele conta como zero. */
shippingRouter.get("/quote", async (req, res) => {
  const { cep, subtotal } = z.object({ cep: z.string().min(1), subtotal: z.coerce.number().min(0).max(1_000_000).default(0) }).parse(req.query);
  res.json(await quoteShipping(cep, subtotal));
});
