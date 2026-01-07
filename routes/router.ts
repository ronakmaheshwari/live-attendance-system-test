import { Router } from "express";

interface RouterInterface {
    router: Router,
    path: string
}

const router:Router = Router();

const allRoutes:RouterInterface[] = []

export default router;