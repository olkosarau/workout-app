import { Router, type IRouter } from "express";
import { MEALS, WEEK_PLAN, WORKOUTS } from "../data/catalog";

const router: IRouter = Router();

router.get("/catalog/workouts", (_req, res) => {
  res.json(WORKOUTS);
});

router.get("/catalog/meals", (_req, res) => {
  res.json(MEALS);
});

router.get("/schedule/week", (_req, res) => {
  res.json(WEEK_PLAN);
});

export default router;
