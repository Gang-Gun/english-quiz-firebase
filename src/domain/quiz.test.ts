import { describe, expect, it } from "vitest";
import { buildQuiz, calculateWrongWordProgress, primaryMeaning, scoreAnswers, validateStudentLogin } from "./quiz";
import type { ScoreRecord, Student, WordEntry } from "./types";

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

describe("primaryMeaning", () => {
  it("strips the part-of-speech tag and keeps the first sense", () => {
    expect(primaryMeaning("[동] 제공하다, 공급하다, 준비하다")).toBe("제공하다");
  });
});

describe("buildQuiz", () => {
  const pool: WordEntry[] = [
    { id: "1", number: 1, english: "provide", meaning: "[동] 제공하다, 공급하다", completed: true },
    { id: "2", number: 2, english: "develop", meaning: "[동] 개발하다, 발전시키다", completed: true },
    { id: "3", number: 3, english: "service", meaning: "[명] 서비스, 봉사", completed: true }
  ];

  it("builds one question per word, each with its correct meaning among the options", () => {
    const quiz = buildQuiz(["provide", "develop", "service"], pool);

    expect(quiz).toHaveLength(3);
    for (const question of quiz) {
      expect(question.options).toContain(question.correct);
    }
    expect(quiz[0]).toMatchObject({ word: "provide", correct: "제공하다" });
  });

  it("limits the number of options and never duplicates the correct answer", () => {
    const quiz = buildQuiz(["provide"], pool, 4);

    expect(quiz[0].options.length).toBeLessThanOrEqual(4);
    const occurrences = quiz[0].options.filter((option) => option === "제공하다").length;
    expect(occurrences).toBe(1);
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
