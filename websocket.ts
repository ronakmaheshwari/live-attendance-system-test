import { WebSocket } from "ws";
import dotenv from "dotenv"
import express, {raw, type Express} from "express"
import { WebSocketServer } from "ws";
import type { Role } from "@prisma/client";
import ApiError from "./utils/error";
import jwt, { type JwtPayload } from "jsonwebtoken"
import { activeSession } from "./utils/attendanceSession";

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

const handleAttendanceMarked = (socket: AuthSocket, data: AttendanceMarkedType) =>{
    if(socket.role !== "teacher"){
        sendError(socket,"Only Teachers can access these services");
    }

    if(!activeSession){
        sendError(socket,"No active Session is running");
    }
    const { studentId, status } = data;
    if (!studentId || !status) {
        sendError(socket, "Invalid attendance payload");
        return;
    }

    if (activeSession) {
        activeSession.attendance[studentId] = status;
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

const handleTodaySummary = (socket: AuthSocket) => {
    if(socket.role !== "teacher"){
        sendError(socket,"Only Teachers can access these services");
    }
    if(!activeSession){
        sendError(socket,"No active Session is running");
    }
    let present: number = 0;
    let absent = 0;
    let total = 0;
    if(activeSession){
        total = Object.keys(activeSession).length;
        present = Object.values(activeSession.attendance).filter((x)=> (
                x === "present"
            )
        ).length
        absent = total - present;
    }
    wss.clients.forEach((ws) =>{
        if(ws.readyState === WebSocket.OPEN){
            ws.send(
                JSON.stringify({
                    event: "TODAY_SUMMARY",
                    data:{
                        total: total,
                        present: present,
                        absent: absent
                    }
                })
            )
        }
    }) 
}

const handleMyAttendance = (socket: AuthSocket) => {
    if(socket.role !== "student"){
        sendError(socket,"This service can only be accessed by students only");
    }
    if(!activeSession){
        sendError(socket,"No active Session is running");
    }
    if(activeSession){
        let status = activeSession.attendance[socket.userId];
        if(!status){
            sendError(socket,"The given user is not part of the session");
        }
        wss.clients.forEach((ws)=>{
            if(ws.readyState === WebSocket.OPEN && ws === socket){
                ws.send(
                    JSON.stringify({
                        event: "MY_ATTENDANCE",
                        data: {
                            status: status
                        }
                    })
                )
            }
        })
    }
}

wss.on("connection",(ws,req)=>{
    const url = require('url');
    const authToken = url.parse(req.url,true).query;
    console.log('Query parameters:', authToken);

    const token = authToken;
    if(!token){
        throw ApiError.unauthorized();
    }
    const decoded = jwt.verify(token, JWT_SECRET as string) as unknown as JwtPayload & {
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
                handleTodaySummary(user);
                break;
            case "MY_ATTENDANCE":

            default:
                ws.send("You were connected successfully")
        }
    })

})