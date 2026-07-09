import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where } from "firebase/firestore";
import { rankings, scores, settings, students, words } from "../demoData";
import type { ClassSettings, RankingRow, ScoreRecord, Student, WordEntry } from "../domain/types";
import { getFirebaseClient } from "./client";

const shouldUseFallback = () => import.meta.env.DEV || import.meta.env.MODE === "test";

function classPath(classId: string, child: string) {
  return `classes/${classId}/${child}`;
}

function normalizeTakenAt(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return new Date(0).toISOString();
}

function normalizeScore(id: string, data: Record<string, unknown>): ScoreRecord {
  return {
    id,
    studentId: String(data.studentId ?? ""),
    studentName: String(data.studentName ?? ""),
    score: Number(data.score ?? 0),
    correctWords: Array.isArray(data.correctWords) ? data.correctWords.map(String) : [],
    wrongWords: Array.isArray(data.wrongWords) ? data.wrongWords.map(String) : [],
    mode: data.mode === "review" ? "review" : "regular",
    takenAt: normalizeTakenAt(data.takenAtIso ?? data.takenAt)
  };
}

async function withFirestore<T>(fallback: () => T, action: () => Promise<T>) {
  const client = getFirebaseClient();
  if (!client || shouldUseFallback()) return fallback();
  try {
    return await action();
  } catch (error) {
    if (shouldUseFallback()) return fallback();
    throw error;
  }
}

export async function studentLogin(input: { classId: string; studentId: string; name?: string }) {
  return withFirestore(
    () => {
      const student = students.find((row) => row.active && row.id === input.studentId.trim());
      return student ? { ok: true as const, student } : { ok: false as const, reason: "not-found" as const };
    },
    async () => {
      const client = getFirebaseClient();
      if (!client) return { ok: false as const, reason: "not-found" as const };
      const snap = await getDoc(doc(client.db, classPath(input.classId, `students/${input.studentId.trim()}`)));
      if (!snap.exists() || snap.data().active === false) return { ok: false as const, reason: "not-found" as const };
      return { ok: true as const, student: { id: snap.id, ...(snap.data() as Omit<Student, "id">) } };
    }
  );
}

export async function adminGetDashboard(input: { classId: string }) {
  return withFirestore(
    () => ({ settings, students, words, scores, rankings }),
    async () => {
      const client = getFirebaseClient();
      if (!client) return { settings, students, words, scores, rankings };
      const [settingsSnap, rankingsSnap, scoresSnap] = await Promise.all([
        getDoc(doc(client.db, classPath(input.classId, "settings/current"))),
        getDoc(doc(client.db, classPath(input.classId, "rankings/current"))),
        getDocs(query(collection(client.db, classPath(input.classId, "scores")), orderBy("takenAt", "desc"), limit(300)))
      ]);
      return {
        settings: (settingsSnap.data() ?? settings) as ClassSettings,
        rankings: ((rankingsSnap.data()?.rows as RankingRow[] | undefined) ?? rankings),
        scores: scoresSnap.docs.map((row) => normalizeScore(row.id, row.data())),
        students,
        words
      };
    }
  );
}

export async function getStudentDashboard(input: { classId: string; studentId: string }) {
  return withFirestore(
    () => ({
      settings,
      scores: scores.filter((score) => score.studentId === input.studentId),
      rankings
    }),
    async () => {
      const client = getFirebaseClient();
      if (!client) return { settings, scores: [], rankings };
      const [settingsSnap, rankingsSnap, scoresSnap] = await Promise.all([
        getDoc(doc(client.db, classPath(input.classId, "settings/current"))),
        getDoc(doc(client.db, classPath(input.classId, "rankings/current"))),
        getDocs(query(collection(client.db, classPath(input.classId, "scores")), where("studentId", "==", input.studentId), orderBy("takenAt", "desc"), limit(100)))
      ]);
      return {
        settings: (settingsSnap.data() ?? settings) as ClassSettings,
        scores: scoresSnap.docs.map((row) => normalizeScore(row.id, row.data())),
        rankings: ((rankingsSnap.data()?.rows as RankingRow[] | undefined) ?? rankings)
      };
    }
  );
}

export async function adminUpdateSettings(input: { classId: string; patch: Partial<ClassSettings> }) {
  return withFirestore(
    () => ({ ok: true, settings: { ...settings, ...input.patch } }),
    async () => {
      const client = getFirebaseClient();
      if (!client) return { ok: true, settings: { ...settings, ...input.patch } };
      await setDoc(doc(client.db, classPath(input.classId, "settings/current")), input.patch, { merge: true });
      const snap = await getDoc(doc(client.db, classPath(input.classId, "settings/current")));
      return { ok: true, settings: (snap.data() ?? { ...settings, ...input.patch }) as ClassSettings };
    }
  );
}

export async function getStudentQuiz(input: { classId: string; studentId: string; mode: "regular" | "review" }) {
  return withFirestore(
    () => ({ words }),
    async () => {
      const client = getFirebaseClient();
      if (!client) return { words };
      const settingsSnap = await getDoc(doc(client.db, classPath(input.classId, "settings/current")));
      const wordCount = Math.max(1, Number(settingsSnap.data()?.wordCount ?? 20));
      const wordsSnap = await getDocs(query(collection(client.db, classPath(input.classId, "words")), where("completed", "==", true), orderBy("number", "desc"), limit(wordCount)));
      return { words: wordsSnap.docs.map((row) => ({ id: row.id, ...(row.data() as Omit<WordEntry, "id">) })) };
    }
  );
}
