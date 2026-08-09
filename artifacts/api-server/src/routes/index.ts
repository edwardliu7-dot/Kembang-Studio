import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import filesRouter from "./files";
import gitRouter from "./git";
import secretsRouter from "./secrets";
import checkpointsRouter from "./checkpoints";
import buildRouter from "./build";
import aiRouter from "./ai";
import studioRouter from "./studio";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(projectsRouter);
router.use(filesRouter);
router.use(gitRouter);
router.use(secretsRouter);
router.use(checkpointsRouter);
router.use(buildRouter);
router.use(aiRouter);
router.use(studioRouter);

export default router;
