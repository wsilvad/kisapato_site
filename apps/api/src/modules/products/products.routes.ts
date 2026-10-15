import { Router } from "express";
import { listProductsQuery, productFiltersQuery } from "./products.schemas.js";
import { getProductBySlug, listProducts, productFacets, relatedProducts } from "./products.service.js";

export const productsRouter = Router();

productsRouter.get("/", async (req, res) => {
  const query = listProductsQuery.parse(req.query);
  res.json(await listProducts(query));
});

productsRouter.get("/facets", async (req, res) => {
  res.json(await productFacets(productFiltersQuery.pick({ selo: true, search: true, ageGroup: true }).parse(req.query)));
});

productsRouter.get("/:slug/related", async (req, res) => {
  res.json(await relatedProducts(req.params.slug));
});

productsRouter.get("/:slug", async (req, res) => {
  res.json(await getProductBySlug(req.params.slug));
});
