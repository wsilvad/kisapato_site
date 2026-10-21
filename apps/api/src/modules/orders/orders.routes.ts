import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middlewares/auth.js";
import { visibleProductWhere } from "../products/products.service.js";
import { recordServerEvent } from "../analytics/server-events.js";
import { recordMovement } from "../stock/stock.service.js";

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const shippingAddressBody = z.object({
  recipient: z.string().trim().min(1),
  zip: z.string().trim().min(8),
  street: z.string().trim().min(1),
  number: z.string().trim().min(1),
  complement: z.string().optional(),
  district: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().length(2),
});

const createOrderBody = z
  .object({
    items: z.array(z.object({ variantId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(20) })).min(1),
    /** Endereço salvo na conta (no checkout, o padrão já vem escolhido). */
    addressId: z.string().min(1).optional(),
    /** Ou um endereço digitado na hora; com `saveAddress` ele também fica salvo na conta. */
    shippingAddress: shippingAddressBody.optional(),
    saveAddress: z.boolean().optional(),
  })
  .refine((b) => b.addressId || b.shippingAddress, "Informe o endereço de entrega");

/** Checkout demonstrativo: valida estoque, baixa e grava o pedido como PENDING (sem pagamento real). */
ordersRouter.post("/", async (req, res) => {
  const { items, addressId, shippingAddress: typedAddress, saveAddress } = createOrderBody.parse(req.body);
  const profileId = req.auth!.sub;

  // CPF é obrigatório para a nota fiscal
  const profile = await prisma.profile.findUniqueOrThrow({ where: { id: profileId }, select: { cpf: true } });
  if (!profile.cpf) throw new AppError("Cadastre seu CPF em Minha conta para finalizar a compra.", 409, "CPF_REQUIRED");

  let shippingAddress: z.infer<typeof shippingAddressBody>;
  if (addressId) {
    const saved = await prisma.address.findFirst({ where: { id: addressId, profileId } });
    if (!saved) throw new AppError("Endereço não encontrado", 404);
    shippingAddress = {
      recipient: saved.recipient, zip: saved.zip, street: saved.street, number: saved.number,
      complement: saved.complement ?? undefined, district: saved.district, city: saved.city, state: saved.state,
    };
  } else {
    shippingAddress = typedAddress!;
  }

  const order = await prisma.$transaction(async (tx) => {
    let total = 0;
    const lines: { variantId: string; quantity: number; unitPrice: string; unitCost: string | null }[] = [];
    const balances: number[] = []; // saldo após cada linha, alinhado a `lines`

    for (const { variantId, quantity } of items) {
      // o custo é omitido por padrão; aqui ele é lido só para gravar o custo da época no item vendido
      const variant = await tx.productVariant.findUnique({ where: { id: variantId }, include: { product: { omit: { costPrice: false } } } });
      const available = variant ? await tx.product.count({ where: { AND: [visibleProductWhere, { id: variant.productId }] } }) : 0;
      if (!variant || available === 0) throw new AppError("Produto indisponível", 409);
      const updated = await tx.productVariant.updateMany({
        where: { id: variantId, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (updated.count === 0) throw new AppError(`Sem estoque de ${variant.product.name} (${variant.color}, ${variant.size})`, 409);
      // preço e custo são da cor (item do ERP) quando ela tem os próprios; senão valem os do produto
      const color = await tx.productColor.findUnique({ where: { productId_name: { productId: variant.productId, name: variant.color } }, omit: { costPrice: false } });
      const unitPrice = color?.price ?? variant.product.price;
      const unitCost = color?.costPrice ?? variant.product.costPrice;
      total += Number(unitPrice) * quantity;
      lines.push({ variantId, quantity, unitPrice: unitPrice.toString(), unitCost: unitCost?.toString() ?? null });
      balances.push(variant.stock - quantity);
    }

    const created = await tx.order.create({
      data: {
        profileId: req.auth!.sub,
        total: total.toFixed(2),
        shippingAddress,
        items: { create: lines },
        events: { create: { status: "PENDING", note: "Pedido recebido" } },
      },
      include: { items: true },
    });
    for (const [i, line] of lines.entries()) {
      await recordMovement(tx, { variantId: line.variantId, type: "SALE", quantity: -line.quantity, balance: balances[i]!, orderId: created.id });
    }
    // endereço digitado no checkout e marcado para salvar: entra na conta (o primeiro vira o padrão)
    if (!addressId && saveAddress) {
      const zip = shippingAddress.zip.replace(/\D/g, "");
      const count = await tx.address.count({ where: { profileId } });
      const duplicate = await tx.address.findFirst({ where: { profileId, zip, number: shippingAddress.number }, select: { id: true } });
      if (count < 10 && !duplicate) await tx.address.create({ data: { ...shippingAddress, zip, profileId, isDefault: count === 0 } });
    }
    return created;
  });

  // medição: a compra é gravada no servidor (o navegador pode estar bloqueando eventos), ligada à visita pelos cabeçalhos do site
  recordServerEvent(req, {
    event: "purchase",
    path: "/checkout",
    cart_value: Number(order.total),
    items_count: order.items.length,
    props: { order_id: order.id, status: order.status, items: order.items.map((i) => ({ variant_id: i.variantId, price: Number(i.unitPrice), quantity: i.quantity })) },
  });
  res.status(201).json(order);
});

ordersRouter.get("/mine", async (req, res) => {
  res.json(
    await prisma.order.findMany({
      where: { profileId: req.auth!.sub },
      include: { items: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
  );
});
