import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();

type Mode = "regular" | "review";

function requireString(data: Record<string, unknown>, key: string) {
  const value = String(data[key] ?? "").trim();
  if (!value) throw new HttpsError("invalid-argument", `${key} required`);
  return value;
}

async function requireAdmin(request: { auth?: { uid?: string }; data: Record<string, unknown> }) {
  if (request.auth?.uid) {
    const snap = await db.collection("admins").doc(request.auth.uid).get();
    if (snap.exists) return;
  }

  const configuredCode = process.env.ADMIN_ACCESS_CODE;
  const providedCode = String(request.data.adminCode ?? "").trim();
  if (configuredCode && providedCode && providedCode === configuredCode) return;

  throw new HttpsError("permission-denied", "Admin access required");
}

async function buildRankings(classId: string) {
  const scoreSnap = await db.collection(`classes/${classId}/scores`).where("mode", "==", "regular").get();
  const stats = new Map<string, { studentName: string; total: number; attempts: number }>();

  for (const doc of scoreSnap.docs) {
    const row = doc.data();
    const studentId = String(row.studentId ?? "");
    if (!studentId) continue;
    const current = stats.get(studentId) ?? { studentName: String(row.studentName ?? ""), total: 0, attempts: 0 };
    current.total += Number(row.score ?? 0);
    current.attempts += 1;
    stats.set(studentId, current);
  }

  let previousAverage: number | null = null;
  let previousRank = 0;
  return Array.from(stats.entries())
    .map(([studentId, stat]) => ({
      studentId,
      studentName: stat.studentName,
      average: Math.round(stat.total / stat.attempts),
      attempts: stat.attempts
    }))
    .sort((a, b) => b.average - a.average || a.studentId.localeCompare(b.studentId))
    .map((row, index) => {
      const rank = row.average === previousAverage ? previousRank : index + 1;
      previousAverage = row.average;
      previousRank = rank;
      return { rank, ...row };
    });
}

async function dashboard(classId: string) {
  const [settingsDoc, rankingsDoc, scoresSnap] = await Promise.all([
    db.doc(`classes/${classId}/settings/current`).get(),
    db.doc(`classes/${classId}/rankings/current`).get(),
    db.collection(`classes/${classId}/scores`).orderBy("takenAt", "desc").limit(300).get()
  ]);

  return {
    settings: settingsDoc.data(),
    rankings: rankingsDoc.data()?.rows ?? [],
    scores: scoresSnap.docs.map((doc) => {
      const row = doc.data();
      return {
        id: doc.id,
        ...row,
        takenAt: row.takenAtIso ?? row.takenAt?.toDate?.().toISOString?.() ?? null
      };
    })
  };
}

export const studentLogin = onCall(async (request) => {
  const classId = requireString(request.data, "classId");
  const studentId = requireString(request.data, "studentId");
  const snap = await db.doc(`classes/${classId}/students/${studentId}`).get();
  const student = snap.data();
  if (!snap.exists || student?.active === false) {
    return { ok: false, reason: "not-found" };
  }
  return { ok: true, student: { id: studentId, name: student?.name, active: student?.active !== false } };
});

export const adminGetDashboard = onCall(async (request) => {
  await requireAdmin(request);
  const classId = requireString(request.data, "classId");
  return dashboard(classId);
});

export const getStudentDashboard = onCall(async (request) => {
  const classId = requireString(request.data, "classId");
  const studentId = requireString(request.data, "studentId");
  const student = await db.doc(`classes/${classId}/students/${studentId}`).get();
  if (!student.exists) throw new HttpsError("permission-denied", "Student not found");

  const [settingsDoc, rankingsDoc, scoresSnap] = await Promise.all([
    db.doc(`classes/${classId}/settings/current`).get(),
    db.doc(`classes/${classId}/rankings/current`).get(),
    db.collection(`classes/${classId}/scores`).where("studentId", "==", studentId).orderBy("takenAt", "desc").limit(100).get()
  ]);

  return {
    settings: settingsDoc.data(),
    rankings: rankingsDoc.data()?.rows ?? [],
    scores: scoresSnap.docs.map((doc) => {
      const row = doc.data();
      return {
        id: doc.id,
        ...row,
        takenAt: row.takenAtIso ?? row.takenAt?.toDate?.().toISOString?.() ?? null
      };
    })
  };
});

export const adminUpdateSettings = onCall(async (request) => {
  await requireAdmin(request);
  const classId = requireString(request.data, "classId");
  const patch = request.data.patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new HttpsError("invalid-argument", "patch object required");
  }
  await db.doc(`classes/${classId}/settings/current`).set(patch, { merge: true });
  return { ok: true, settings: (await db.doc(`classes/${classId}/settings/current`).get()).data() };
});

export const getStudentQuiz = onCall(async (request) => {
  const classId = requireString(request.data, "classId");
  const studentId = requireString(request.data, "studentId");
  const mode = (String(request.data.mode ?? "regular") === "review" ? "review" : "regular") as Mode;
  const settings = (await db.doc(`classes/${classId}/settings/current`).get()).data();
  if (settings?.examStatus !== "ON") throw new HttpsError("failed-precondition", "Exam is closed");

  const student = await db.doc(`classes/${classId}/students/${studentId}`).get();
  if (!student.exists) throw new HttpsError("permission-denied", "Student not found");

  const wordCount = Math.max(1, Number(settings?.wordCount ?? 20));
  let wordsSnap;
  if (mode === "review") {
    const recentWrong = await db.collection(`classes/${classId}/scores`).where("studentId", "==", studentId).orderBy("takenAt", "desc").limit(30).get();
    const wrong = Array.from(new Set(recentWrong.docs.flatMap((doc) => doc.data().wrongWords ?? []))).slice(0, wordCount);
    wordsSnap = wrong.length
      ? await db.collection(`classes/${classId}/words`).where("english", "in", wrong.slice(0, 10)).get()
      : await db.collection(`classes/${classId}/words`).where("completed", "==", true).orderBy("number", "desc").limit(wordCount).get();
  } else {
    wordsSnap = await db.collection(`classes/${classId}/words`).where("completed", "==", true).orderBy("number", "desc").limit(wordCount).get();
  }

  const words = wordsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { words };
});

export const saveResult = onCall(async (request) => {
  const classId = requireString(request.data, "classId");
  const studentId = requireString(request.data, "studentId");
  const studentName = requireString(request.data, "studentName");
  const score = Number(request.data.score ?? 0);
  const mode = (String(request.data.mode ?? "regular") === "review" ? "review" : "regular") as Mode;
  const record = {
    studentId,
    studentName,
    score,
    correctWords: Array.isArray(request.data.correctWords) ? request.data.correctWords : [],
    wrongWords: Array.isArray(request.data.wrongWords) ? request.data.wrongWords : [],
    mode,
    takenAt: Timestamp.now(),
    takenAtIso: new Date().toISOString(),
    createdAt: FieldValue.serverTimestamp()
  };
  await db.collection(`classes/${classId}/scores`).add(record);
  const rows = await buildRankings(classId);
  await db.doc(`classes/${classId}/rankings/current`).set({ rows, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true, dashboard: await dashboard(classId) };
});

export const rebuildRankings = onCall(async (request) => {
  await requireAdmin(request);
  const classId = requireString(request.data, "classId");
  const rows = await buildRankings(classId);
  await db.doc(`classes/${classId}/rankings/current`).set({ rows, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true, rows };
});
