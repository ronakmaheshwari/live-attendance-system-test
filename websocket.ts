import { WebSocket } from "ws";
import dotenv from "dotenv"
import express, {raw, type Express} from "express"
import { WebSocketServer } from "ws";
import type { Role } from "@prisma/client";
import ApiError from "./utils/error";
import jwt, { type JwtPayload } from "jsonwebtoken"
//import { activeSession, endSession } from "./utils/attendanceSession";
import db from "./utils/db";
import { deleteSession, findStudentAttendance, getSession, markAttendance, todaySummary } from "./utils/redis";

dotenv.config();
const app: Express = express()
const port = 3001
const server = app.listen(port,()=>{
    console.log(`WS running on ${port}`)
})

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw ApiError.internal("JWT secret is missing");
}

interface PayloadType {
    event: string,
    data: any;
}

interface AuthSocket extends WebSocket {
    userId: string,
    role: Role
}

interface AttendanceMarkedType {
    classId: string;
    studentId: string;
    status: "present" | "absent";
}

const wss = new WebSocketServer({server: server});

const sendError = (ws: WebSocket, message: string) =>{
    ws.send(
        JSON.stringify({
            error: "ERROR",
            data: message ?? "Internal error occured"
        })
    );
}

const handleAttendanceMarked = async (socket: AuthSocket, data: AttendanceMarkedType) =>{
    if(socket.role !== "teacher"){
        sendError(socket,"Only Teachers can access these services");
    }
    const activeSession = await getSession(data.classId);
    
    if(!activeSession){
        sendError(socket,"No active Session is running");
    }

    const { studentId, status, classId } = data;
    if (!studentId || !status) {
        sendError(socket, "Invalid attendance payload");
        return;
    }
    const handle_Attendance = await markAttendance(classId,studentId,status);
    if(handle_Attendance !== true){
        sendError(socket,"No active Session is running");
    }
    
    wss.clients.forEach((ws)=>{
        if(ws.readyState === WebSocket.OPEN){
            ws.send(
                JSON.stringify({
                    event: "ATTENDANCE_MARKED",
                    data: {
                        studentId,
                        status
                    }
                })
            )
        }
    })
}

const handleTodaySummary = async (socket: AuthSocket,classId: string) => {
    if(socket.role !== "teacher"){
        sendError(socket,"Only Teachers can access these services");
    }
    const activeSession = await getSession(classId);
    if(!activeSession){
        sendError(socket,"No active Session is running");
    }

    // let present: number = 0;
    // let absent = 0;
    // let total = 0;
    // if(activeSession){
    //     total = Object.keys(activeSession).length;
    //     present = Object.values(activeSession.attendance).filter((x)=> (
    //             x === "present"
    //         )
    //     ).length
    //     absent = total - present;
    // }

    const getSummary = await todaySummary(classId);
    if(!getSummary.success){
        sendError(socket,"No active Session is running");
    }
    wss.clients.forEach((ws) =>{
        if(ws.readyState === WebSocket.OPEN){
            ws.send(
                JSON.stringify({
                    event: "TODAY_SUMMARY",
                    data:{
                        total: getSummary.total,
                        present: getSummary.present,
                        absent: getSummary.absent
                    }
                })
            )
        }
    }) 
}

const handleMyAttendance = async (socket: AuthSocket,classId: string) => {
    if(socket.role !== "student"){
        sendError(socket,"This service can only be accessed by students only");
    }
    const activeSession = await getSession(classId);
    
    if(!activeSession){
        sendError(socket,"No active Session is running");
    }

    if(activeSession){
        //let status = activeSession.attendance[socket.userId] ?? "not yet updated";
        let status = await findStudentAttendance(classId, socket.userId) 

        if(!status.success){
            sendError(socket,"The given user is not part of the session");
        }
        let details = status.status ?? "Not yet updated";

        wss.clients.forEach((ws)=>{
            if(ws.readyState === WebSocket.OPEN && ws === socket){
                ws.send(
                    JSON.stringify({
                        event: "MY_ATTENDANCE",
                        data: {
                            status: details
                        }
                    })
                )
            }
        })
    }
}

const handleTodayClass = async (socket: AuthSocket, classId: string) => {
    if(socket.role !== "teacher"){
        sendError(socket,"This service can only be accessed by Teachers only");
    }
    const activeSession = await getSession(classId);
    
    if(!activeSession){
        sendError(socket,"No active Session is running");
    }

    if(activeSession){
        const getStudents = await db.classStudent.findMany({
            where:{
                classId: activeSession.classId
            },
            include:{
                student: true
            }
        })

        const getMarked = Object.keys(activeSession.attendance);

        const addAbsent = getStudents.forEach(async (x)=>{

           if(!getMarked.includes(x.studentId)){
              //activeSession.attendance[x.studentId] = "absent";
              await markAttendance(classId, x.studentId, "absent");
           }

        })

        for(let x of Object.keys(activeSession.attendance)) {
            const status = activeSession.attendance[x];
            if (status) {
                const addToDb = await db.attendance.create({
                    data:{
                        classId: activeSession.classId,
                        studentId: x,
                        status: status
                    }
                })
            }
        }

        const [total, present, absent] = await Promise.all([
            db.classStudent.count({
                where:{
                    classId: activeSession.classId
                }
            }),
            db.attendance.count({
                where:{
                    classId: activeSession.classId,
                    status: "present"
                }
            }),
            db.attendance.count({
                where:{
                    classId: activeSession.classId,
                    status: "absent"
                }
            })
        ])

        await deleteSession(classId);

        wss.clients.forEach((ws)=>{
            if(ws.readyState === WebSocket.OPEN){
                ws.send(
                    JSON.stringify({
                        event: "DONE",
                        data: {
                            message: "Attendance persisted" ,
                            present: present,
                            absent: absent,
                            total: total
                        }
                    })
                )
            }
        })
    }
}

wss.on("connection",(ws,req)=>{
    const url = require('url');
    const parsedUrl = url.parse(req.url, true);
    const token = parsedUrl.query.token as string;
    
    if(!token){
        throw ApiError.unauthorized();
    }
    
    const decoded = jwt.verify(token, JWT_SECRET as string) as JwtPayload & {
    userId: string;
    role: Role;
    };
    if (!decoded.userId || !decoded.role) {
      throw ApiError.unauthorized("Invalid token payload");
    }
    const user = ws as AuthSocket;

    user.userId = decoded.userId;
    user.role = decoded.role;

    ws.on("message",async (raw) =>{
        let payload: PayloadType;
        try {
            payload = JSON.parse(raw.toString());
        } catch (error) {
            return;
        }
        switch(payload.event){
            case "ATTENDANCE_MARKED":
                handleAttendanceMarked(user,payload.data);
                break;
            case "TODAY_SUMMARY":
                handleTodaySummary(user,payload.data);
                break;
            case "MY_ATTENDANCE":
                handleMyAttendance(user,payload.data);
                break;
            case "DONE":
                handleTodayClass(user, payload.data);
                break;
            default:
                ws.send("You were connected successfully")
        }
    })

    ws.on("close", () =>{
        ws.send("Connection has closed");
    })
})