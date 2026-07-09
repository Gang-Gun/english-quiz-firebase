import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import XLSX from "xlsx";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/xlsx-to-sheet-export.mjs <workbook.xlsx> <sheet-export.json>");
  process.exit(1);
}

const workbook = XLSX.readFile(resolve(inputPath), { cellDates: true });
const sheets = {};

for (const sheetName of workbook.SheetNames) {
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    dateNF: "yyyy-mm-dd hh:mm:ss"
  });
  sheets[sheetName] = rows.filter((row) => row.some((cell) => String(cell ?? "").trim()));
}

const output = {
  classId: "204",
  source: {
    spreadsheetId: "1KgeWu_I4tNdXPwMtVB4Qm8WzLCwB6b0f1Xmnhu0sqg8",
    title: "2학년 4반 영어시험",
    exportedAt: new Date().toISOString()
  },
  sheets
};

mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(resolve(outputPath), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${Object.keys(sheets).length} sheets to ${outputPath}`);
