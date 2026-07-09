import { buildRankings } from "../domain/rankings";
import type { ClassSettings, ScoreRecord, Student, WordEntry } from "../domain/types";

type SheetRow = Array<string | number | Date | null | undefined>;

export interface SpreadsheetExport {
  classId: string;
  sheets: Record<string, SheetRow[]>;
}

export interface FirestoreClassExport {
  classId: string;
  students: Student[];
  settings: ClassSettings;
  words: WordEntry[];
  scoreRecords: ScoreRecord[];
  rankings: ReturnType<typeof buildRankings>;
}

const text = (value: unknown) => String(value ?? "").trim();
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(text(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

function splitWords(value: unknown) {
  return text(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const raw = text(value);
  if (!raw) return new Date(0).toISOString();
  const normalized = raw.replace(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/, "$1-$2-$3");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function readSettings(rows: SheetRow[]): ClassSettings {
  const byName = new Map(rows.slice(1).map((row) => [text(row[0]), row[1]]));
  return {
    examStatus: text(byName.get("시험 상태")) === "ON" ? "ON" : "OFF",
    wordCount: numberValue(byName.get("오늘 볼 단어 수"), 20),
    lastWordNumber: numberValue(byName.get("마지막 출제 번호"), 0),
    reviewEnabled: true
  };
}

function readStudents(rows: SheetRow[]): Student[] {
  return rows
    .filter((row) => text(row[0]) && text(row[1]))
    .map((row) => ({ id: text(row[0]), name: text(row[1]), active: true }));
}

function readWords(rows: SheetRow[]): WordEntry[] {
  return rows.slice(1).filter((row) => text(row[0]) && text(row[1])).map((row) => ({
    id: text(row[0]),
    number: numberValue(row[0]),
    english: text(row[1]),
    meaning: text(row[2]),
    completed: text(row[3]) === "완료",
    completedAt: text(row[4]) || undefined
  }));
}

function modeFromKorean(value: unknown) {
  return text(value) === "오답재시험" ? "review" as const : "regular" as const;
}

function readScoreRecords(sheets: Record<string, SheetRow[]>): ScoreRecord[] {
  const records: ScoreRecord[] = [];
  for (const [sheetName, rows] of Object.entries(sheets)) {
    if (!sheetName.startsWith("성적_")) continue;
    for (const row of rows.slice(1)) {
      const studentId = text(row[1]) || sheetName.replace("성적_", "");
      if (!studentId || !text(row[0])) continue;
      records.push({
        id: `${studentId}-${records.length + 1}`,
        studentId,
        studentName: text(row[2]),
        score: numberValue(row[3]),
        correctWords: splitWords(row[4]),
        wrongWords: splitWords(row[6]),
        mode: modeFromKorean(row[7]),
        takenAt: toIso(row[0])
      });
    }
  }
  return records;
}

export function transformSpreadsheetExport(input: SpreadsheetExport): FirestoreClassExport {
  const students = readStudents(input.sheets["학생"] ?? []);
  const settings = readSettings(input.sheets["설정"] ?? []);
  const words = readWords(input.sheets["단어DB"] ?? []);
  const scoreRecords = readScoreRecords(input.sheets);

  return {
    classId: input.classId,
    students,
    settings,
    words,
    scoreRecords,
    rankings: buildRankings(scoreRecords)
  };
}
