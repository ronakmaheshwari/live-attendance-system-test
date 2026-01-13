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

allRoutes.forEach((x)=>{
    router.use(x.path,x.router);
})

export default router;