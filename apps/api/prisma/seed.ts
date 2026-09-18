import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const categories = [
  { name: "Tênis", slug: "tenis" },
  { name: "Sandálias", slug: "sandalias" },
  { name: "Botas", slug: "botas" },
];

const products = [
  {
    name: "Tênis Urbano Classic",
    slug: "tenis-urbano-classic",
    brand: "Ki Sapato",
    price: "249.90",
    category: "tenis",
    colors: ["Preto", "Branco"],
    sizes: [38, 39, 40, 41, 42],
  },
  {
    name: "Sandália Conforto Verão",
    slug: "sandalia-conforto-verao",
    brand: "Ki Sapato",
    price: "129.90",
    category: "sandalias",
    colors: ["Caramelo"],
    sizes: [34, 35, 36, 37, 38],
  },
  {
    name: "Bota Couro Trail",
    slug: "bota-couro-trail",
    brand: "Ki Sapato",
    price: "389.90",
    category: "botas",
    colors: ["Marrom"],
    sizes: [39, 40, 41, 42, 43],
  },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({ where: { slug: category.slug }, update: {}, create: category });
  }

  for (const { category, colors, sizes, ...data } of products) {
    const { id: categoryId } = await prisma.category.findUniqueOrThrow({ where: { slug: category } });

    await prisma.product.upsert({
      where: { slug: data.slug },
      update: {},
      create: {
        ...data,
        categoryId,
        images: [],
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

  console.log("Seed concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
