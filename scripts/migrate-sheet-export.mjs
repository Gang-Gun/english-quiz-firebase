import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/migrate-sheet-export.mjs <sheet-export.json> <firestore-import.json>");
  process.exit(1);
}

const input = JSON.parse(readFileSync(resolve(inputPath), "utf8"));

const text = (value) => String(value ?? "").trim();
const numberValue = (value, fallback = 0) => {
  const parsed = Number(text(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const splitWords = (value) => text(value).split(",").map((item) => item.trim()).filter(Boolean);

function toIso(value) {
  const raw = text(value);
  if (!raw) return new Date(0).toISOString();
  const normalized = raw.replace(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/, "$1-$2-$3");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function buildRankings(rows) {
  const stats = new Map();
  for (const row of rows) {
    if (row.mode !== "regular") continue;
    const stat = stats.get(row.studentId) ?? { studentName: row.studentName, total: 0, attempts: 0 };
    stat.total += row.score;
    stat.attempts += 1;
    stats.set(row.studentId, stat);
  }
  let lastAverage = null;
  let lastRank = 0;
  return Array.from(stats.entries())
    .map(([studentId, stat]) => ({
      studentId,
      studentName: stat.studentName,
      average: Math.round(stat.total / stat.attempts),
      attempts: stat.attempts
    }))
    .sort((a, b) => b.average - a.average || a.studentId.localeCompare(b.studentId))
    .map((row, index) => {
      const rank = row.average === lastAverage ? lastRank : index + 1;
      lastAverage = row.average;
      lastRank = rank;
      return { rank, ...row };
    });
}

function transformSpreadsheetExport(source) {
  const settingsRows = source.sheets["설정"] ?? [];
  const settingMap = new Map(settingsRows.slice(1).map((row) => [text(row[0]), row[1]]));
  const students = (source.sheets["학생"] ?? [])
    .filter((row) => text(row[0]) && text(row[1]))
    .map((row) => ({ id: text(row[0]), name: text(row[1]), active: true }));
  const words = (source.sheets["단어DB"] ?? []).slice(1)
    .filter((row) => text(row[0]) && text(row[1]))
    .map((row) => ({
      id: text(row[0]),
      number: numberValue(row[0]),
      english: text(row[1]),
      meaning: text(row[2]),
      completed: text(row[3]) === "완료",
      completedAt: text(row[4]) || null
    }));
  const scoreRecords = [];
  for (const [sheetName, rows] of Object.entries(source.sheets)) {
    if (!sheetName.startsWith("성적_")) continue;
    for (const row of rows.slice(1)) {
      const studentId = text(row[1]) || sheetName.replace("성적_", "");
      if (!studentId || !text(row[0])) continue;
      scoreRecords.push({
        id: `${studentId}-${scoreRecords.length + 1}`,
        studentId,
        studentName: text(row[2]),
        score: numberValue(row[3]),
        correctWords: splitWords(row[4]),
        wrongWords: splitWords(row[6]),
        mode: text(row[7]) === "오답재시험" ? "review" : "regular",
        takenAt: toIso(row[0])
      });
    }
  }

  const historyRows = (source.sheets["성적기록"] ?? []).slice(1);
  for (const row of historyRows) {
    const studentId = text(row[1]);
    if (!studentId || !text(row[0])) continue;
    const duplicate = scoreRecords.some((record) => record.studentId === studentId && record.takenAt === toIso(row[0]));
    if (duplicate) continue;
    scoreRecords.push({
      id: `${studentId}-${scoreRecords.length + 1}`,
      studentId,
      studentName: text(row[2]),
      score: numberValue(row[3]),
      correctWords: [],
      wrongWords: splitWords(row[6]),
      mode: "regular",
      takenAt: toIso(row[0])
    });
  }

  return {
    classId: source.classId,
    students,
    settings: {
      examStatus: text(settingMap.get("시험 상태")) === "ON" ? "ON" : "OFF",
      wordCount: numberValue(settingMap.get("오늘 볼 단어 수"), 20),
      lastWordNumber: numberValue(settingMap.get("마지막 출제 번호"), 0),
      reviewEnabled: true
    },
    words,
    scoreRecords,
    rankings: buildRankings(scoreRecords)
  };
}

const output = transformSpreadsheetExport(input);
mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(resolve(outputPath), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${output.students.length} students, ${output.words.length} words, ${output.scoreRecords.length} score records to ${outputPath}`);
