export type ExamMode = "regular" | "review";

export interface Student {
  id: string;
  name: string;
  active: boolean;
}

export interface WordEntry {
  id: string;
  number: number;
  english: string;
  meaning: string;
  completed: boolean;
  completedAt?: string;
}

export interface QuizAnswer {
  word: string;
  choice: string;
  correct: string;
}

export interface ScoreRecord {
  id: string;
  studentId: string;
  studentName: string;
  score: number;
  correctWords: string[];
  wrongWords: string[];
  mode: ExamMode;
  takenAt: string;
}

export interface ClassSettings {
  examStatus: "ON" | "OFF";
  wordCount: number;
  lastWordNumber: number;
  reviewEnabled: boolean;
}

export interface RankingRow {
  rank: number;
  studentId: string;
  studentName: string;
  average: number;
  attempts: number;
}
