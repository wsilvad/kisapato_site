import { Router } from "express";
import { accountRouter } from "../modules/account/account.routes.js";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { audiencesRouter, brandsRouter, categoriesRouter, classesRouter } from "../modules/categories/categories.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";
import { homeRouter } from "../modules/home/home.routes.js";
import { ordersRouter } from "../modules/orders/orders.routes.js";
import { productsRouter } from "../modules/products/products.routes.js";
import { settingsRouter } from "../modules/settings/settings.routes.js";
import { shippingRouter } from "../modules/shipping/shipping.routes.js";
import { uploadsRouter } from "../modules/uploads/uploads.routes.js";

export const routes = Router();

routes.use("/health", healthRouter);
routes.use("/categories", categoriesRouter);
routes.use("/classes", classesRouter);
routes.use("/audiences", audiencesRouter);
routes.use("/brands", brandsRouter);
routes.use("/products", productsRouter);
routes.use("/home", homeRouter);
routes.use("/settings", settingsRouter);
routes.use("/shipping", shippingRouter);
routes.use("/auth", authRouter);
routes.use("/account", accountRouter);
routes.use("/orders", ordersRouter);
routes.use("/admin", adminRouter);
routes.use("/admin/uploads", uploadsRouter);
