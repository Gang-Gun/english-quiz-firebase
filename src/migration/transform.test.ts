import { describe, expect, it } from "vitest";
import { transformSpreadsheetExport } from "./transform";

describe("transformSpreadsheetExport", () => {
  it("turns sheet tabs into Firestore-shaped class data", () => {
    const result = transformSpreadsheetExport({
      classId: "204",
      sheets: {
        학생: [["20401", "권도엽"]],
        설정: [["항목", "설정값"], ["마지막 출제 번호", "535"], ["오늘 볼 단어 수", "20"], ["시험 상태", "ON"]],
        단어DB: [["번호", "영단어", "뜻", "출제여부", "출제날짜"], ["1", "provide", "제공하다", "완료", "2026. 3. 9"]],
        성적_20401: [["날짜", "학번", "이름", "점수", "맞은단어", "소요시간", "틀린단어", "시험종류"], ["2026. 3. 9", "20401", "권도엽", "100", "provide", "0", "", "정규시험"]]
      }
    });

    expect(result.students).toEqual([{ id: "20401", name: "권도엽", active: true }]);
    expect(result.settings).toMatchObject({ examStatus: "ON", wordCount: 20, lastWordNumber: 535 });
    expect(result.words[0]).toMatchObject({ id: "1", english: "provide", meaning: "제공하다", completed: true });
    expect(result.scoreRecords[0]).toMatchObject({ studentId: "20401", score: 100, mode: "regular" });
  });
});
