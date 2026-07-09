import { rankings, scores, settings, students, words } from "../demoData";
import type { ClassSettings } from "../domain/types";
import { callable } from "./client";

const adminCode = () => sessionStorage.getItem("voca_admin_code") || "";

export async function studentLogin(input: { classId: string; studentId: string; name?: string }) {
  const remote = callable<typeof input, unknown>("studentLogin");
  if (remote) return (await remote(input)).data;
  const student = students.find((row) => row.active && row.id === input.studentId.trim());
  return student ? { ok: true as const, student } : { ok: false as const, reason: "not-found" as const };
}

export async function adminGetDashboard(input: { classId: string }) {
  const payload = { ...input, adminCode: adminCode() };
  const remote = callable<typeof payload, unknown>("adminGetDashboard");
  if (remote) return (await remote(payload)).data;
  return { settings, students, words, scores, rankings };
}

export async function getStudentDashboard(input: { classId: string; studentId: string }) {
  const remote = callable<typeof input, unknown>("getStudentDashboard");
  if (remote) return (await remote(input)).data;
  return {
    settings,
    scores: scores.filter((score) => score.studentId === input.studentId),
    rankings
  };
}

export async function adminUpdateSettings(input: { classId: string; patch: Partial<ClassSettings> }) {
  const payload = { ...input, adminCode: adminCode() };
  const remote = callable<typeof payload, unknown>("adminUpdateSettings");
  if (remote) return (await remote(payload)).data;
  return { ok: true, settings: { ...settings, ...input.patch } };
}
