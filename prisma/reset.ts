import db from "../utils/db";

async function reset() {
    await db.user.deleteMany({});
    await db.class.deleteMany({});
    await db.classStudent.deleteMany({});
    await db.attendance.deleteMany({})
}

reset();