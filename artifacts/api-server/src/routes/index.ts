import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import sitemapRouter from "./sitemap";
import ordersRouter from "./orders";
import webhooksRouter from "./webhooks";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(sitemapRouter);
router.use(ordersRouter);
router.use(webhooksRouter);
router.use(stripeRouter);

export default router;
