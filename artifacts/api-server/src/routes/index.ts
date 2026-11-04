import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import catalogRouter from "./catalog";
import progressRouter from "./progress";

const router: IRouter = Router();

router.use(healthRouter, authRouter, catalogRouter, progressRouter);

export default router;
