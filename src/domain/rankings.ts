import type { RankingRow, ScoreRecord } from "./types";

export function buildRankings(rows: ScoreRecord[]): RankingRow[] {
  const stats = new Map<string, { studentName: string; total: number; attempts: number }>();

  for (const row of rows) {
    if (row.mode !== "regular") continue;
    const existing = stats.get(row.studentId) ?? { studentName: row.studentName, total: 0, attempts: 0 };
    existing.total += row.score;
    existing.attempts += 1;
    stats.set(row.studentId, existing);
  }

  const sorted = Array.from(stats.entries())
    .map(([studentId, stat]) => ({
      studentId,
      studentName: stat.studentName,
      average: Math.round(stat.total / stat.attempts),
      attempts: stat.attempts
    }))
    .sort((a, b) => b.average - a.average || a.studentId.localeCompare(b.studentId));

  let previousAverage: number | null = null;
  let previousRank = 0;
  return sorted.map((row, index) => {
    const rank = previousAverage === row.average ? previousRank : index + 1;
    previousAverage = row.average;
    previousRank = rank;
    return { rank, ...row };
  });
}
