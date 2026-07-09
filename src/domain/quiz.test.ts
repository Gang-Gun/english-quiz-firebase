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
  const words: WordEntry[] = Array.from({ length: 10 }, (_, i) => ({
    id: String(i + 1),
    number: i + 1,
    english: `word${i + 1}`,
    meaning: `[동] 뜻${i + 1}, 별칭${i + 1}`,
    completed: true
  }));

  // Deterministic rng so the type distribution and options are assertable.
  const rng = () => 0;

  it("builds one question per word using the english headword as the identifier", () => {
    const quiz = buildQuiz(words, words, rng);
    expect(quiz).toHaveLength(10);
    expect(new Set(quiz.map((q) => q.word))).toEqual(new Set(words.map((w) => w.english)));
  });

  it("distributes question types 40% en-ko, 40% ko-en, 20% subjective", () => {
    const quiz = buildQuiz(words, words, rng);
    const counts = quiz.reduce<Record<string, number>>((acc, q) => {
      acc[q.type] = (acc[q.type] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ "en-ko": 4, "ko-en": 4, subjective: 2 });
  });

  it("puts the correct answer among the options for multiple-choice questions", () => {
    const quiz = buildQuiz(words, words, rng);
    for (const question of quiz) {
      if (question.type === "subjective") {
        expect(question.options).toHaveLength(0);
      } else {
        expect(question.options).toContain(question.answer);
        expect(question.options.length).toBeLessThanOrEqual(4);
        expect(question.options.filter((option) => option === question.answer)).toHaveLength(1);
      }
    }
  });

  it("asks for the english word in ko-en and subjective questions", () => {
    const quiz = buildQuiz(words, words, rng);
    for (const question of quiz) {
      if (question.type === "ko-en" || question.type === "subjective") {
        expect(question.answer).toMatch(/^word\d+$/);
      } else {
        expect(question.answer).toMatch(/^뜻\d+$/);
      }
    }
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
