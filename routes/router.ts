import { Router } from "express";
import userRouter from "./user";

interface RouterInterface {
    router: Router,
    path: string
}

const router:Router = Router();

const allRoutes:RouterInterface[] = [
    {
        router: userRouter,
        path: "/user"
    }
]

export default router;