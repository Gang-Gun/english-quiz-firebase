import type { QuizAnswer, ScoreRecord, Student, WordEntry } from "./types";

const clean = (value: unknown) => String(value ?? "").trim();

export interface QuizQuestion {
  word: string;
  correct: string;
  options: string[];
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

export function buildQuiz(quizWords: string[], pool: WordEntry[], optionCount = 4, rng: () => number = Math.random): QuizQuestion[] {
  const byEnglish = new Map(pool.map((entry) => [entry.english, entry]));
  const meanings = Array.from(new Set(pool.map((entry) => primaryMeaning(entry.meaning))));

  return quizWords.map((word) => {
    const entry = byEnglish.get(word);
    const correct = entry ? primaryMeaning(entry.meaning) : word;
    const distractors = shuffle(meanings.filter((meaning) => meaning !== correct), rng).slice(0, Math.max(0, optionCount - 1));
    return { word, correct, options: shuffle([correct, ...distractors], rng) };
  });
}

export function validateStudentLogin(students: Student[], id: string, name: string) {
  const targetId = clean(id);
  const targetName = clean(name);
  const student = students.find((row) => row.active && row.id === targetId && row.name === targetName);
  return student ? { ok: true as const, student } : { ok: false as const, reason: "not-found" as const };
}

export function scoreAnswers(answers: QuizAnswer[]) {
  let correctCount = 0;
  const correctWords: string[] = [];
  const wrongWords: string[] = [];

  for (const answer of answers) {
    if (clean(answer.choice) === clean(answer.correct)) {
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
