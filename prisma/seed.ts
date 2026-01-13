import { password } from "bun"
import db from "../utils/db"
import type { Role } from "@prisma/client"

async function main() {
    const users = [
        {id: "user-1", name: "jack", email: "jack@gmail.com", password: "Pass@123", role: "teacher"},
        {id: "user-2", name: "danial", email: "danial@gmail.com",password: "Pass@123", role: "student"},
        {id: "user-3", name: "sam", email: "sam@gmail.com",password: "Pass@123", role: "student"},
        {id: "user-4", name: "beth", email: "beth@gmail.com",password: "Pass@123", role: "student"},
        {id: "user-5", name: "ema", email: "ema@gmail.com",password: "Pass@123", role: "student"},
        {id: "user-6", name: "vega", email: "vega@gmail.com",password: "Pass@123", role: "student"}
    ]
    
    users.forEach(async (x)=>{
        await db.user.upsert({
            where:{
                email: x.email
            },
            update:{},
            create:{
                id: x.id,
                name: x.name,
                email: x.email,
                password: x.password,
                role: x.role as Role
            }
        })
    })
}

main();