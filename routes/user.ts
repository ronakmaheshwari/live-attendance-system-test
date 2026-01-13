import dotenv from "dotenv"
import { Router, type Request, type Response } from "express";
import { addStudentType, classType, SigninType, SignupType } from "../utils/types";
import db from "../utils/db";
import bcrypt from "bcrypt"
import ApiError from "../utils/error";
import jwt from "jsonwebtoken"
import userMiddleware from "../middleware";
import { activeSession, startSession,type ActiveSession } from "../utils/attendanceSession";

dotenv.config();

const SaltRound = Number(process.env.SALT_ROUND ?? 10);

if (Number.isNaN(SaltRound)) {
  throw ApiError.internal("Invalid SALT_ROUND value");
}
const JWT = process.env.JWT_SECRET;
if(!JWT){
    throw ApiError.internal()
}

const userRouter: Router = Router();

userRouter.get("/me",userMiddleware,async (req: Request,res: Response) => {
    try {
        const user = req.user;
        if(!user?.userId || !user.role){
            return res.status(402).json({
                error: true,
                data: "Unauthorized user tried to access services"
            })
        }
        
        const findUser = await db.user.findUnique({
            where:{
                id: user.userId
            },
            select:{
                name: true,
                email: true,
                role: true
            }
        })
        if(!findUser){
            return res.status(404).json({
                error: true,
                data: `No user was found with that ${user.userId}`
            })
        }
        return res.status(200).json({
            error: false,
            data: findUser
        })
    } catch (error) {
        console.log("[User Router ME]: Error that took place at ",error);
    }
})

userRouter.get("/students",userMiddleware,async(req: Request,res: Response)=>{
    try {
        const user = req.user;
        if(!user?.userId || !user.role){
            return res.status(402).json({
                error: true,
                data: "Unauthorized user tried to access services"
            })
        }
        if(user.role !== "teacher"){
            return res.status(400).json({
                error: true,
                data: "Only Teacher can access these service"
            })
        }
        const findAll = await db.user.findMany({
            where:{
                role: "student"
            },
            select:{
                id: true,
                name: true,
                email: true
            }
        })
        return res.status(200).json({
            error: false,
            data: {
                students: findAll.map((x) => ({
                    id: x.id,
                    name: x.name,
                    email: x.email
                }))
            }
        })
    } catch (error) {
        console.log("[User Router Students]: Error that took place at ",error);
    }
})

userRouter.get("/class/:id/my-attendance",userMiddleware,async(req: Request,res: Response)=>{
    try {
        const user = req.user;
        if(!user?.userId || !user.role){
            return res.status(402).json({
                error: true,
                data: "Unauthorized user tried to access services"
            })
        }
        if(user.role !== "student"){
            return res.status(402).json({
                error: true,
                data: "This Service can only be accessed by students only"
            })
        }
        const classId = req.params.id;
        if(!classId){
            return res.status(404).json({
                error: true,
                data: "No classId was provided"
            })
        }
        const findStudent = await db.classStudent.findUnique({
            where:{
                studentId_classId:{
                    classId,
                    studentId: user.userId
                }
            },
            include:{
                class: true
            }
        })
        if(!findStudent){
            return res.status(404).json({
                error: true,
                data: `You are not enrolled in the given class`
            })
        }
        const findPresent = await db.attendance.findFirst({
            where:{
                classId: classId,
                studentId: user.userId,
            }
        })
        return res.status(200).json({
            error: false,
            data: `You successfully fetched your presenties in the class ${findStudent.class.className}`,
            classId: findStudent.classId,
            status: findPresent?.status ?? null
        })
    } catch (error) {
        console.log("[User Router MY-Attendance]: Error that took place at ",error);
    }
})

userRouter.post("/:id/attendance/start",async(req: Request,res: Response)=>{
    try {
        const user = req.user;
        if(!user?.userId || !user.role){
            return res.status(402).json({
                error: true,
                data: "Unauthorized user tried to access services"
            })
        }
        if(user.role !== "teacher"){
            return res.status(402).json({
                error: true,
                data: "This Service can only be accessed by teachers only"
            })
        }
        const classId = req.params.id
        if(!classId){
            return res.status(402).json({
                error: true,
                data: "No classId was provided"
            })
        }
        const findClass = await db.class.findUnique({
            where:{
                id: classId,
                teacherId: user.userId
            }
        })
        if(!findClass){
            return res.status(404).json({
                error: true,
                data:`The Class doesnt belong to you`
            })
        }
        if (activeSession) {
            throw ApiError.conflict(
            "An attendance session is already active"
            );
        }
        let session:ActiveSession = startSession(classId);
        return res.status(200).json({
        success: true,
        data: {
            classId: session.classId,
            startedAt: session.startedAt,
        },
        });
    } catch (error) {
        console.log("[User Router Attendance-Start]: Error that took place at ",error);
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
        const hashedPassword = await bcrypt.hash(password, SaltRound);
        const createUser = await db.user.create({
            data:{
                name,
                email,
                password: hashedPassword,
                role
            }
        })
        const token = jwt.sign({userId: createUser.id,role: createUser.role},JWT,{expiresIn: "1d"});
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
        const token = jwt.sign({userId: findUser.id,role: findUser.role},JWT, {
                expiresIn: "1d",
            }
        );
        return res.status(200).json({
            error: false,
            token: token,
            data: `${findUser.name} was successfully logged in`
        })
    } catch (error) {
        console.log("[User Router Login]: Error that took place at ",error);
    }
})

userRouter.post("/class",userMiddleware,async (req: Request,res: Response) => {
    try {
        const user = req.user;
        if(!user?.userId || !user.role){
            return res.status(402).json({
                error: true,
                data: "Unauthorized user tried to access services"
            })
        }
        if(user.role !== "teacher"){
            return res.status(400).json({
                error: true,
                data: "Only Teacher can access these service"
            })
        }
        const parsed = classType.safeParse(req.body);
        if(!parsed.success){
            return res.status(400).json({
                error: true,
                data: "Invalid class-name was provided"
            })
        }
        const {className} = parsed.data;
        const createClass = await db.class.create({
            data:{
                className: className,
                teacherId: user.userId,
            }
        })
        return res.status(200).json({
            error: false,
            data: "Class was Successfully created",
        })
    } catch (error) {
        console.log("[User Router Class]: Error that took place at ",error);
    }
})

userRouter.get("/class/:id",userMiddleware,async (req: Request,res: Response) => {
    try {
        const classId = req.params.id;
        const user = req.user;
        if(!user?.userId || !user.role){
            return res.status(402).json({
                error: true,
                data: "Unauthorized user tried to access services"
            })
        }
        const findUser = await db.class.findUnique({
            where:{
                id: classId,
            },
            include:{
                students:{
                    include:{
                        student:{
                            select:{
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            }
        })
        
        if(!findUser){
            return res.status(404).json({
                error: true,
                data: "Invalid ClassId was provided"
            })
        }
        const isTeacher = user.role === "teacher" && findUser.teacherId === user.userId;
        const isStudentAllowed = user.role === "student" && findUser.students.some((x) => x.studentId === user.userId);
        if(!isTeacher || !isStudentAllowed){
            return res.status(402).json({
                error: true,
                data: "Unauthorized user tried to access class"
            })
        }
        return res.status(200).json({
            error: false,
            data:{
                id: findUser.id,
                className: findUser.className,
                teacher: findUser.teacherId,
                students: findUser.students.map((x)=>({
                    id: x.studentId,
                    name: x.student.name,
                    email: x.student.email
                }))
            }
        })
    } catch (error) {
        console.log("[User Router GETClassDetails]: Error that took place at ",error);
    }
})

userRouter.post("/class/:id/add-student",userMiddleware,async (req: Request,res: Response) => {
    try {
        const user = req.user;
        if(!user?.userId || !user.role){
            return res.status(402).json({
                error: true,
                data: "Unauthorized user tried to access services"
            })
        }
        if(user.role !== "teacher"){
            return res.status(400).json({
                error: true,
                data: "Only Teacher can access this service"
            })
        }
        const parsed = addStudentType.safeParse(req.body);
        if(!parsed.success){
            return res.status(400).json({
                error: true,
                data: "Invalid Student Type was provided"
            })
        }
        const {studentId} = parsed.data;
        const classId = req.params.id;
        const findClass = await db.class.findUnique({
            where:{
                id: classId,
                teacherId: user.userId
            }
        })
        if(!findClass){
            return res.status(400).json({
                error: true,
                data:"Invalid ClassId was provided or Class doesnt belong to you"
            })
        }

        const findUser = await db.user.findUnique({
            where:{
                id: studentId
            }
        })
        if(!findUser){
            return res.status(400).json({
                error: true,
                data:"Invalid StudentId was provided"
            })
        }
        const addUser = await db.classStudent.create({
            data: {
                studentId: findUser.id,
                classId: findClass.id
            }
        })
        return res.status(200).json({
            error: false,
            data: `${findUser.name} was added in class ${findClass.className}`
        })
    } catch (error) {
        console.log("[User Router Add_Student]: Error that took place at ",error);
    }
})


export default userRouter;