import { Router } from "express";
import { categoriesRouter } from "../modules/categories/categories.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";
import { productsRouter } from "../modules/products/products.routes.js";

export const routes = Router();

routes.use("/health", healthRouter);
routes.use("/categories", categoriesRouter);
routes.use("/products", productsRouter);
