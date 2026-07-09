import { describe, expect, it } from "vitest";
import { calculateWrongWordProgress, scoreAnswers, validateStudentLogin } from "./quiz";
import type { ScoreRecord, Student } from "./types";

describe("validateStudentLogin", () => {
  it("accepts a matching student id and exact normalized name", () => {
    const students: Student[] = [{ id: "20401", name: "권도엽", active: true }];
    expect(validateStudentLogin(students, " 20401 ", " 권도엽 ")).toEqual({
      ok: true,
      student: students[0]
    });
  });

  it("rejects inactive or mismatched students", () => {
    const students: Student[] = [{ id: "20401", name: "권도엽", active: false }];
    expect(validateStudentLogin(students, "20401", "권도엽")).toEqual({
      ok: false,
      reason: "not-found"
    });
  });
});

describe("scoreAnswers", () => {
  it("scores answers and separates corrected and wrong words", () => {
    const result = scoreAnswers([
      { word: "provide", choice: "제공하다", correct: "제공하다" },
      { word: "develop", choice: "발달", correct: "개발하다" },
      { word: "service", choice: "service", correct: "service" }
    ]);

    expect(result).toEqual({
      score: 67,
      correctWords: ["provide", "service"],
      wrongWords: ["develop"]
    });
  });
});

describe("calculateWrongWordProgress", () => {
  it("removes words after a later corrected record", () => {
    const rows: ScoreRecord[] = [
      { id: "r1", studentId: "20401", studentName: "권도엽", score: 50, correctWords: [], wrongWords: ["provide", "develop"], mode: "regular", takenAt: "2026-03-09T00:00:00.000Z" },
      { id: "r2", studentId: "20401", studentName: "권도엽", score: 100, correctWords: ["provide"], wrongWords: [], mode: "review", takenAt: "2026-03-10T00:00:00.000Z" }
    ];

    expect(calculateWrongWordProgress("20401", rows)).toEqual(["develop"]);
  });
});
