import { Router } from "express";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { categoriesRouter } from "../modules/categories/categories.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";
import { homeRouter } from "../modules/home/home.routes.js";
import { ordersRouter } from "../modules/orders/orders.routes.js";
import { productsRouter } from "../modules/products/products.routes.js";
import { uploadsRouter } from "../modules/uploads/uploads.routes.js";

export const routes = Router();

routes.use("/health", healthRouter);
routes.use("/categories", categoriesRouter);
routes.use("/products", productsRouter);
routes.use("/home", homeRouter);
routes.use("/auth", authRouter);
routes.use("/orders", ordersRouter);
routes.use("/admin", adminRouter);
routes.use("/admin/uploads", uploadsRouter);
