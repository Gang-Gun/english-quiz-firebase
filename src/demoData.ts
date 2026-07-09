import { buildRankings } from "./domain/rankings";
import type { ClassSettings, ScoreRecord, Student, WordEntry } from "./domain/types";

export const classId = "204";

export const students: Student[] = [
  { id: "20401", name: "권도엽", active: true },
  { id: "20402", name: "김경민", active: true },
  { id: "20403", name: "김다윗", active: true },
  { id: "20404", name: "김도안", active: true }
];

export const settings: ClassSettings = {
  examStatus: "ON",
  wordCount: 20,
  lastWordNumber: 535,
  reviewEnabled: true
};

export const words: WordEntry[] = [
  { id: "1", number: 1, english: "provide", meaning: "[동] 제공하다, 공급하다, 준비하다", completed: true, completedAt: "2026-03-09" },
  { id: "2", number: 2, english: "develop", meaning: "[동] 개발하다, 발달하다, 발전시키다", completed: true, completedAt: "2026-03-09" },
  { id: "3", number: 3, english: "service", meaning: "[명] 서비스, 근무, 봉사, 공공 업무", completed: true, completedAt: "2026-03-09" }
];

export const scores: ScoreRecord[] = [
  {
    id: "r1",
    studentId: "20401",
    studentName: "권도엽",
    score: 93,
    correctWords: ["provide"],
    wrongWords: ["develop"],
    mode: "regular",
    takenAt: "2026-07-08T08:05:00.000Z"
  },
  {
    id: "r2",
    studentId: "20402",
    studentName: "김경민",
    score: 100,
    correctWords: ["provide", "develop"],
    wrongWords: [],
    mode: "regular",
    takenAt: "2026-07-08T08:06:00.000Z"
  },
  {
    id: "r3",
    studentId: "20403",
    studentName: "김다윗",
    score: 80,
    correctWords: ["service"],
    wrongWords: ["provide"],
    mode: "regular",
    takenAt: "2026-07-08T08:07:00.000Z"
  },
  {
    id: "r4",
    studentId: "20401",
    studentName: "권도엽",
    score: 100,
    correctWords: ["develop"],
    wrongWords: [],
    mode: "review",
    takenAt: "2026-07-08T08:20:00.000Z"
  }
];

export const rankings = buildRankings(scores);
