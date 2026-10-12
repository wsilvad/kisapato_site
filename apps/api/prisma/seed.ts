import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
});

const classes = [
  { name: "Calçados", slug: "calcados", sortOrder: 0 },
  { name: "Acessórios", slug: "acessorios", sortOrder: 1 },
];

const audiences = [
  { name: "Feminino", slug: "feminino", sortOrder: 0 },
  { name: "Masculino", slug: "masculino", sortOrder: 1 },
  { name: "Infantil", slug: "infantil", sortOrder: 2 },
  { name: "Unissex", slug: "unissex", sortOrder: 3 },
];

const categories = [
  { name: "Tênis", slug: "tenis" },
  { name: "Sandálias", slug: "sandalias" },
  { name: "Botas", slug: "botas" },
];

const products = [
  {
    name: "Tênis Urbano Classic",
    slug: "tenis-urbano-classic",
    price: "249.90",
    category: "tenis",
    colors: ["Preto", "Branco"],
    sizes: [38, 39, 40, 41, 42],
  },
  {
    name: "Sandália Conforto Verão",
    slug: "sandalia-conforto-verao",
    price: "129.90",
    category: "sandalias",
    colors: ["Caramelo"],
    sizes: [34, 35, 36, 37, 38],
  },
  {
    name: "Bota Couro Trail",
    slug: "bota-couro-trail",
    price: "389.90",
    category: "botas",
    colors: ["Marrom"],
    sizes: [39, 40, 41, 42, 43],
  },
];

async function main() {
  const brand = await prisma.brand.upsert({ where: { slug: "ki-sapato" }, update: {}, create: { name: "Ki Sapato", slug: "ki-sapato" } });
  for (const data of classes) await prisma.productClass.upsert({ where: { slug: data.slug }, update: {}, create: data });
  for (const data of audiences) await prisma.audience.upsert({ where: { slug: data.slug }, update: {}, create: data });

  const { id: classId } = await prisma.productClass.findUniqueOrThrow({ where: { slug: "calcados" } });
  for (const category of categories) {
    await prisma.category.upsert({ where: { slug: category.slug }, update: {}, create: { ...category, classId } });
  }

  for (const { category, colors, sizes, ...data } of products) {
    const { id: categoryId } = await prisma.category.findUniqueOrThrow({ where: { slug: category } });

    await prisma.product.upsert({
      where: { slug: data.slug },
      update: {},
      create: {
        ...data,
        categoryId,
        brandId: brand.id,
        variants: {
          create: colors.flatMap((color) =>
            sizes.map((size) => ({
              sku: `${data.slug}-${color}-${size}`.toLowerCase().replace(/\s+/g, "-"),
              color,
              size,
              stock: 10,
            })),
          ),
        },
      },
    });
  }

  await prisma.showcase.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000001", title: "Destaques", selectionRule: "DESTAQUE", itemLimit: 4 },
  });

  // Admin inicial: defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no .env (a senha não é versionada).
  const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: password } = process.env;
  if (email && password) {
    await prisma.profile.upsert({
      where: { email },
      update: { role: "ADMIN" },
      create: { email, name: "Administrador", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
    });
    console.log(`Admin garantido: ${email}`);
  }

  console.log("Seed concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
