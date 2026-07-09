import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

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
  const credential = credentialFromEnv();
  initializeApp(credential ? { projectId, credential } : { projectId });
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

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)])) } };
  }
  return { stringValue: String(value) };
}

function firestoreFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)]));
}

function firebaseToolsConfigPath() {
  return process.env.FIREBASE_TOOLS_CONFIG || join(homedir(), ".config", "configstore", "firebase-tools.json");
}

async function accessTokenFromFirebaseTools() {
  const config = JSON.parse(readFileSync(firebaseToolsConfigPath(), "utf8"));
  const refreshToken = config.tokens?.refresh_token;
  if (!refreshToken) throw new Error("Firebase CLI refresh token not found. Run firebase login first.");

  const body = new URLSearchParams({
    client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
    client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error(`Could not refresh Firebase CLI access token: ${response.status} ${await response.text()}`);
  const json = await response.json();
  return json.access_token;
}

function docName(projectId, path) {
  return `projects/${projectId}/databases/(default)/documents/${path}`;
}

async function commitRest(projectId, token, writes) {
  for (let index = 0; index < writes.length; index += 400) {
    const chunk = writes.slice(index, index + 400);
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ writes: chunk })
    });
    if (!response.ok) throw new Error(`Firestore commit failed: ${response.status} ${await response.text()}`);
  }
}

async function seedWithRest(projectId) {
  const token = await accessTokenFromFirebaseTools();
  const now = new Date().toISOString();
  const base = `classes/${data.classId}`;
  const writes = [
    {
      update: {
        name: docName(projectId, base),
        fields: firestoreFields({
          title: "2학년 4반 영어시험",
          sourceSpreadsheetId: "1KgeWu_I4tNdXPwMtVB4Qm8WzLCwB6b0f1Xmnhu0sqg8",
          updatedAt: now
        })
      }
    },
    {
      update: {
        name: docName(projectId, `${base}/settings/current`),
        fields: firestoreFields(data.settings)
      }
    },
    {
      update: {
        name: docName(projectId, `${base}/rankings/current`),
        fields: firestoreFields({ rows: data.rankings, updatedAt: now })
      }
    },
    ...data.students.map((student) => ({
      update: { name: docName(projectId, `${base}/students/${student.id}`), fields: firestoreFields(student) }
    })),
    ...data.words.map((word) => ({
      update: { name: docName(projectId, `${base}/words/${word.id}`), fields: firestoreFields(word) }
    })),
    ...data.scoreRecords.map((score) => ({
      update: {
        name: docName(projectId, `${base}/scores/${score.id}`),
        fields: firestoreFields({ ...score, takenAt: score.takenAt, takenAtIso: score.takenAt })
      }
    }))
  ];

  await commitRest(projectId, token, writes);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  await seedWithRest(projectId);
  console.log(`Seeded class ${data.classId}: ${data.students.length} students, ${data.words.length} words, ${data.scoreRecords.length} score records.`);
  process.exit(0);
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
