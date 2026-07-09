import type { QuizAnswer, ScoreRecord, Student, WordEntry } from "./types";

const clean = (value: unknown) => String(value ?? "").trim();

// The three exam formats the original Apps Script produced.
//  - "en-ko": show the English word, pick the Korean meaning
//  - "ko-en": show the Korean meaning, pick the English word
//  - "subjective": show the Korean meaning, type the English word
export type QuizType = "en-ko" | "ko-en" | "subjective";

export interface QuizQuestion {
  word: string; // english headword, stored in correctWords/wrongWords
  type: QuizType;
  prompt: string; // what the student is shown
  answer: string; // the accepted correct answer
  options: string[]; // choices for the multiple-choice types (empty for subjective)
}

// "[동] 제공하다, 공급하다, 준비하다" -> "제공하다"
export function primaryMeaning(meaning: string): string {
  const withoutTag = clean(meaning).replace(/^\[[^\]]*\]\s*/, "");
  const first = withoutTag.split(",")[0]?.trim();
  return first || withoutTag;
}

function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function questionTypeFor(index: number, total: number): QuizType {
  if (index < total * 0.4) return "en-ko";
  if (index < total * 0.8) return "ko-en";
  return "subjective";
}

function distractors(pool: string[], answer: string, count: number, rng: () => number): string[] {
  const others = Array.from(new Set(pool)).filter((value) => value && value !== answer);
  return shuffle(others, rng).slice(0, count);
}

// Builds one question per word, mirroring the original 40% / 40% / 20% mix of
// en-ko / ko-en / subjective, then shuffles the question order. `optionPool`
// supplies the wrong choices for the multiple-choice questions.
export function buildQuiz(words: WordEntry[], optionPool: WordEntry[] = words, rng: () => number = Math.random): QuizQuestion[] {
  const total = words.length;
  const meaningPool = optionPool.map((entry) => primaryMeaning(entry.meaning));
  const englishPool = optionPool.map((entry) => entry.english);

  const questions = words.map((entry, index) => {
    const type = questionTypeFor(index, total);
    const meaning = primaryMeaning(entry.meaning);

    if (type === "en-ko") {
      return { word: entry.english, type, prompt: entry.english, answer: meaning, options: shuffle([meaning, ...distractors(meaningPool, meaning, 3, rng)], rng) };
    }
    if (type === "ko-en") {
      return { word: entry.english, type, prompt: meaning, answer: entry.english, options: shuffle([entry.english, ...distractors(englishPool, entry.english, 3, rng)], rng) };
    }
    return { word: entry.english, type, prompt: `${meaning} (입력)`, answer: entry.english, options: [] as string[] };
  });

  return shuffle(questions, rng);
}

export function validateStudentLogin(students: Student[], id: string, name: string) {
  const targetId = clean(id);
  const targetName = clean(name);
  const student = students.find((row) => row.active && row.id === targetId && row.name === targetName);
  return student ? { ok: true as const, student } : { ok: false as const, reason: "not-found" as const };
}

const normalizeAnswer = (value: unknown) => clean(value).toLowerCase();

export function scoreAnswers(answers: QuizAnswer[]) {
  let correctCount = 0;
  const correctWords: string[] = [];
  const wrongWords: string[] = [];

  for (const answer of answers) {
    if (normalizeAnswer(answer.choice) === normalizeAnswer(answer.correct)) {
      correctCount += 1;
      correctWords.push(answer.word);
    } else {
      wrongWords.push(answer.word);
    }
  }

  return {
    score: answers.length ? Math.round((correctCount / answers.length) * 100) : 0,
    correctWords,
    wrongWords
  };
}

export function calculateWrongWordProgress(studentId: string, rows: ScoreRecord[]) {
  const wrongWords = new Map<string, string>();
  const ordered = rows
    .filter((row) => row.studentId === studentId)
    .slice()
    .sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());

  for (const row of ordered) {
    for (const word of row.wrongWords) wrongWords.set(word, word);
    for (const word of row.correctWords) wrongWords.delete(word);
  }

  return Array.from(wrongWords.values());
}
