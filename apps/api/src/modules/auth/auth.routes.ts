import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { signToken } from "../../lib/auth.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middlewares/auth.js";

export const authRouter = Router();

const registerBody = z.object({
  name: z.string().trim().min(2),
  email: z.email().transform((v) => v.toLowerCase()),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "A senha precisa de ao menos 8 caracteres"),
});

const loginBody = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});

const publicProfile = { id: true, email: true, name: true, phone: true, role: true } as const;

authRouter.post("/register", async (req, res) => {
  const { password, ...data } = registerBody.parse(req.body);
  if (await prisma.profile.findUnique({ where: { email: data.email } })) {
    throw new AppError("E-mail já cadastrado", 409);
  }
  const user = await prisma.profile.create({
    data: { ...data, passwordHash: await bcrypt.hash(password, 12) },
    select: publicProfile,
  });
  res.status(201).json({ token: signToken({ sub: user.id, role: user.role }), user });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = loginBody.parse(req.body);
  const found = await prisma.profile.findUnique({ where: { email } });
  if (!found || !(await bcrypt.compare(password, found.passwordHash))) {
    throw new AppError("E-mail ou senha inválidos", 401);
  }
  const { passwordHash: _omit, ...user } = found;
  res.json({
    token: signToken({ sub: user.id, role: user.role }),
    user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.profile.findUnique({ where: { id: req.auth!.sub }, select: publicProfile });
  if (!user) throw new AppError("Usuário não encontrado", 404);
  res.json(user);
});
