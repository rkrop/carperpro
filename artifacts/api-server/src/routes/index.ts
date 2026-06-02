import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import ordersRouter from "./orders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(ordersRouter);

export default router;
