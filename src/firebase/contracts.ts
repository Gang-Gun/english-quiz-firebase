import { rankings, scores, settings, students, words } from "../demoData";
import type { ClassSettings } from "../domain/types";
import { callable } from "./client";

const adminCode = () => sessionStorage.getItem("voca_admin_code") || "";
const shouldUseFallback = () => import.meta.env.DEV || import.meta.env.MODE === "test";

async function callRemote<T>(name: string, input: T) {
  const remote = callable<T, unknown>(name);
  if (!remote) return undefined;
  try {
    return (await remote(input)).data;
  } catch (error) {
    if (shouldUseFallback()) return undefined;
    throw error;
  }
}

export async function studentLogin(input: { classId: string; studentId: string; name?: string }) {
  const result = await callRemote("studentLogin", input);
  if (result) return result;
  const student = students.find((row) => row.active && row.id === input.studentId.trim());
  return student ? { ok: true as const, student } : { ok: false as const, reason: "not-found" as const };
}

export async function adminGetDashboard(input: { classId: string }) {
  const payload = { ...input, adminCode: adminCode() };
  const result = await callRemote("adminGetDashboard", payload);
  if (result) return result;
  return { settings, students, words, scores, rankings };
}

export async function getStudentDashboard(input: { classId: string; studentId: string }) {
  const result = await callRemote("getStudentDashboard", input);
  if (result) return result;
  return {
    settings,
    scores: scores.filter((score) => score.studentId === input.studentId),
    rankings
  };
}

export async function adminUpdateSettings(input: { classId: string; patch: Partial<ClassSettings> }) {
  const payload = { ...input, adminCode: adminCode() };
  const result = await callRemote("adminUpdateSettings", payload);
  if (result) return result;
  return { ok: true, settings: { ...settings, ...input.patch } };
}
