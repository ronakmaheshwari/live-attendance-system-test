import { RedisClient } from "bun";
//import type { ActiveSession } from "./attendanceSession";
import type { Status } from "@prisma/client";
import ApiError from "./error";

export const client = new RedisClient();

await client.connect();
console.log("Redis connected");

export type ActiveSession = {
    success?: boolean,
    classId: string,
    startedAt: Date,
    attendance: Record<string,Status>,
}
export let activeSession: ActiveSession | null = null;

const sessionKey = (classId: string) => `attendance:active:${classId}`;
const markedKey = (classId: string) => `attendance:marked:${classId}`;
const SESSION_TTL_SECONDS = 60 * 60 * 2;

export const getSession = async (
  classId: string
): Promise<ActiveSession | null> => {
  const activeSession = await client.get(sessionKey(classId));
  if (!activeSession) return null;

  const attendance = await client.hgetall(markedKey(classId));

  return {
    success: true,
    classId,
    startedAt: new Date(activeSession),
    attendance: attendance as Record<string, Status>
  };
};

export const startSession = async (
  classId: string
): Promise<ActiveSession> => {
  const startedAt = new Date().toISOString();

  const result = await client.set(
    sessionKey(classId),
    startedAt,
    "NX",
    "EX",
    SESSION_TTL_SECONDS.toString()
  );

  if (result !== "OK") {
    throw new Error("Attendance session already active");
  }

  return {
    classId,
    startedAt: new Date(startedAt),
    attendance: {}
  };
};

export const markAttendance = async (
  classId: string,
  studentId: string,
  status: Status
): Promise<boolean> => {
  const activeSession = await client.get(sessionKey(classId));
  if(!activeSession){
    return false
  }
  await client.hset(
    markedKey(classId),
    studentId,
    status
  )
  await client.expire(markedKey(classId), SESSION_TTL_SECONDS);
  
  return true;
}

export const deleteSession = async (classId: string) => {
  await client.del(
    sessionKey(classId),
    markedKey(classId)
  );

  return {
    error: false,
    data: "Successfully deleted"
  };
};

export const todaySummary = async (classId: string) => {
  const activeSession = await client.get(sessionKey(classId));
  if(!activeSession){
    return {
      success: false
    }
  }
  let attendance = await client.hgetall(markedKey(classId));
  let total = 0;
  let present = 0;
  let absent = 0;

  Object.values(attendance).forEach((x)=>{
    total++;
    if(x == "present" || x == "PRESENT"){
      present++;
    }
  })
  absent = total - present;
  return {
    success: true,
    total,
    present,
    absent
  }
}

export const findStudentAttendance = async (classId: string, studentId: string,) => {
  const activeSession = await client.get(sessionKey(classId));
  if(!activeSession){
    return {
      success: false
    }
  }
  const findStatus = await client.hgetall(markedKey(classId));
  if(!findStatus){
    return {
      success: false,
      status: "Not yet updated"
    }
  }
  const status = findStatus[studentId];
  return {
    success: true,
    status: status
  }
}