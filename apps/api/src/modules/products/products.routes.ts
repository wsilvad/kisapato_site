import { Router } from "express";
import { listProductsQuery } from "./products.schemas.js";
import { getProductBySlug, listProducts } from "./products.service.js";

export const productsRouter = Router();

productsRouter.get("/", async (req, res) => {
  const query = listProductsQuery.parse(req.query);
  res.json(await listProducts(query));
});

productsRouter.get("/:slug", async (req, res) => {
  res.json(await getProductBySlug(req.params.slug));
});
