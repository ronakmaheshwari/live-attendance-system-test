import type { Status } from "@prisma/client"

export type ActiveSession = {
    classId: string,
    startedAt: Date,
    attendance: Record<string,Status>,
}
export let activeSession: ActiveSession | null = null;

export const getStartSession = () => activeSession;

export const startSession = (classId: string) =>{
    if(activeSession){
        throw new Error("Attendance session already active");
    }
    activeSession = {
        classId,
        startedAt: new Date(),
        attendance:{}
    }
    return activeSession
}

export const endSession = () =>{
    activeSession = null;
}