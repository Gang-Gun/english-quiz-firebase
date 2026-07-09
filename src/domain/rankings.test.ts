import { describe, expect, it } from "vitest";
import { buildRankings } from "./rankings";
import type { ScoreRecord } from "./types";

describe("buildRankings", () => {
  it("uses competition ranking with ties by average regular score", () => {
    const rows: ScoreRecord[] = [
      { id: "1", studentId: "20401", studentName: "권도엽", score: 100, correctWords: [], wrongWords: [], mode: "regular", takenAt: "2026-03-09T00:00:00.000Z" },
      { id: "2", studentId: "20402", studentName: "김경민", score: 100, correctWords: [], wrongWords: [], mode: "regular", takenAt: "2026-03-09T00:00:00.000Z" },
      { id: "3", studentId: "20403", studentName: "김다윗", score: 80, correctWords: [], wrongWords: [], mode: "regular", takenAt: "2026-03-09T00:00:00.000Z" }
    ];

    expect(buildRankings(rows).map((row) => [row.rank, row.studentId, row.average])).toEqual([
      [1, "20401", 100],
      [1, "20402", 100],
      [3, "20403", 80]
    ]);
  });
});
