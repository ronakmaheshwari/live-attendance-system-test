import { WebSocket } from "ws";
import dotenv from "dotenv"
import express, {raw, type Express} from "express"
import { WebSocketServer } from "ws";
import type { Role } from "@prisma/client";
import ApiError from "./utils/error";
import jwt, { type JwtPayload } from "jsonwebtoken"

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

const wss = new WebSocketServer({server: server});

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
            case "":
                
        }
    })

})