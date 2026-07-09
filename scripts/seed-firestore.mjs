import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [inputPath, projectIdArg] = process.argv.slice(2);

if (!inputPath) {
  console.error("Usage: node scripts/seed-firestore.mjs <firestore-import.json> [projectId]");
  process.exit(1);
}

const projectId = projectIdArg || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
if (!projectId) {
  console.error("Set FIREBASE_PROJECT_ID or pass [projectId].");
  process.exit(1);
}

function credentialFromEnv() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return undefined;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return undefined;
  return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
}

if (!getApps().length) {
  initializeApp({ projectId, credential: credentialFromEnv() });
}

const db = getFirestore();
const data = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
const classRef = db.collection("classes").doc(data.classId);

function toTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
}

async function writeBatches(items, writer) {
  for (let index = 0; index < items.length; index += 400) {
    const batch = db.batch();
    for (const item of items.slice(index, index + 400)) writer(batch, item);
    await batch.commit();
  }
}

await classRef.set({
  title: "2학년 4반 영어시험",
  sourceSpreadsheetId: "1KgeWu_I4tNdXPwMtVB4Qm8WzLCwB6b0f1Xmnhu0sqg8",
  updatedAt: Timestamp.now()
}, { merge: true });

await classRef.collection("settings").doc("current").set(data.settings, { merge: true });
await classRef.collection("rankings").doc("current").set({ rows: data.rankings, updatedAt: Timestamp.now() });

await writeBatches(data.students, (batch, student) => {
  batch.set(classRef.collection("students").doc(student.id), student);
});

await writeBatches(data.words, (batch, word) => {
  batch.set(classRef.collection("words").doc(word.id), word);
});

await writeBatches(data.scoreRecords, (batch, score) => {
  const takenAt = toTimestamp(score.takenAt);
  batch.set(classRef.collection("scores").doc(score.id), {
    ...score,
    takenAt,
    takenAtIso: score.takenAt
  });
});

console.log(`Seeded class ${data.classId}: ${data.students.length} students, ${data.words.length} words, ${data.scoreRecords.length} score records.`);
