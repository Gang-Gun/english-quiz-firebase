import type { QuizAnswer, ScoreRecord, Student } from "./types";

const clean = (value: unknown) => String(value ?? "").trim();

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
