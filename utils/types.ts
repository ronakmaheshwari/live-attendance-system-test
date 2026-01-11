import z, { email } from "zod"

export const SignupType = z.object({
    name: z.string().min(4).max(20),
    email: z.email({error: "Invalid Email was provided"}),
    password: z.string({error:"Invalid password was provided"}).min(6,{error: "Password must be 6 letters or more"}).max(64,{error: "Password was above 64 letters"}),
    role: z.enum(["teacher","student"]),
})

export const SigninType = z.object({
    email: z.string({error: "Invalid Email was provided"}),
    password: z.string({error: "Invalid password was provided"}).min(6,{error: "Password must be 6 letters or more"}).max(64,{error: "Password was above 64 letters"})
})

export const classType = z.object({
    className: z.string().min(3,{error: "The classname is less than 3 letters"})
})

export const addStudentType = z.object({
    studentId: z.string()
})

export const attendanceType = z.object({
    classId: z.string()
})