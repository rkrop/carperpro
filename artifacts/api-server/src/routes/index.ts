import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import postalCodesRouter from "./postalCodes";
import sitemapRouter from "./sitemap";
import ordersRouter from "./orders";
import webhooksRouter from "./webhooks";
import stripeRouter from "./stripe";
import accountRouter from "./account";
import assistantRouter from "./assistant";
import scanRouter from "./scan";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(postalCodesRouter);
router.use(sitemapRouter);
router.use(ordersRouter);
router.use(webhooksRouter);
router.use(stripeRouter);
router.use(accountRouter);
router.use(assistantRouter);
router.use(scanRouter);
router.use(authRouter);

export default router;
