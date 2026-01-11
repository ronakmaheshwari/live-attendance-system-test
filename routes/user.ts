import dotenv from "dotenv"
import { Router, type Request, type Response } from "express";
import { SigninType, SignupType } from "../utils/types";
import db from "../utils/db";
import bcrypt from "bcrypt"
import ApiError from "../utils/error";
import jwt from "jsonwebtoken"

dotenv.config();

const SaltRound = process.env.SALT_ROUND
const JWT = process.env.JWT_SECRET;
if(!SaltRound || !JWT){
    throw ApiError.internal()
}

const userRouter: Router = Router();

userRouter.get("/me",async (req: Request,res: Response) => {
    try {
        
    } catch (error) {
        console.log("[User Router Signup]: Error that took place at ",error);
    }
})

userRouter.post("/signup",async(req: Request,res: Response) =>{
    try {
        const parsed = SignupType.safeParse(req.body);
        if(!parsed.success){
            const parser = parsed.error.flatten
            return res.status(400).json({
                error: true,
                data: parser
            })
        }   
        const {name,email,password,role} = parsed.data;
        const findUser = await db.user.findUnique({
            where:{
                email: email
            }
        })
        if(findUser){
            return res.status(409).json({
                error: true,
                data: `Email ${findUser.email} already exists with our servers`
            })
        }
        const hashedPassword =await bcrypt.hash(password,SaltRound);
        const createUser = await db.user.create({
            data:{
                name,
                email,
                password: hashedPassword,
                role
            }
        })
        const token = jwt.sign({userId: createUser.id,role: createUser.role},JWT);
        return res.status(200).json({
            error: false,
            token: token,
            data: `${(createUser.name).toUpperCase()} was Successfully created`
        })
    } catch (error) {
        console.log("[User Router Signup]: Error that took place at ",error);
    }
})

userRouter.post("/login",async (req:Request,res: Response) => {
    try {
        const parsed = SigninType.safeParse(req.body);
        if(!parsed.success){
            const parser = parsed.error.flatten
            return res.status(400).json({
                error: true,
                data: parser
            })
        }
        const {email,password} = parsed.data;
        const findUser = await db.user.findUnique({
            where:{
                email
            }
        })
        if(!findUser){
            return res.status(404).json({
                error: true,
                data: "Invalid email was provided"
            })
        }
        const hash = await bcrypt.compare(password,findUser.password);
        if(!hash){
            return res.status(401).json({
                error: true,
                data: "Invalid password was provided"
            })
        }
        const token = jwt.sign({userId: findUser.id,role: findUser.role},JWT);
        return res.status(200).json({
            error: false,
            token: token,
            data: `${findUser.name} was successfully logged in`
        })
    } catch (error) {
        console.log("[User Router Signup]: Error that took place at ",error);
    }
})

export default userRouter;