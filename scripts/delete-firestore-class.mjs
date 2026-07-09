import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [projectId, classId = "204"] = process.argv.slice(2);

if (!projectId) {
  console.error("Usage: node scripts/delete-firestore-class.mjs <projectId> [classId]");
  process.exit(1);
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
  return (await response.json()).access_token;
}

function collectionUrl(path, pageToken = "") {
  const params = new URLSearchParams({ pageSize: "300" });
  if (pageToken) params.set("pageToken", pageToken);
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?${params}`;
}

async function listDocumentNames(token, path) {
  const names = [];
  let pageToken = "";
  do {
    const response = await fetch(collectionUrl(path, pageToken), {
      headers: { authorization: `Bearer ${token}` }
    });
    if (response.status === 404) return names;
    if (!response.ok) throw new Error(`List failed for ${path}: ${response.status} ${await response.text()}`);
    const json = await response.json();
    names.push(...(json.documents ?? []).map((doc) => doc.name));
    pageToken = json.nextPageToken ?? "";
  } while (pageToken);
  return names;
}

async function commitDeletes(token, names) {
  for (let index = 0; index < names.length; index += 400) {
    const chunk = names.slice(index, index + 400);
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ writes: chunk.map((name) => ({ delete: name })) })
    });
    if (!response.ok) throw new Error(`Delete commit failed: ${response.status} ${await response.text()}`);
  }
}

const token = await accessTokenFromFirebaseTools();
const base = `classes/${classId}`;
const names = [
  ...(await listDocumentNames(token, `${base}/students`)),
  ...(await listDocumentNames(token, `${base}/words`)),
  ...(await listDocumentNames(token, `${base}/scores`)),
  ...(await listDocumentNames(token, `${base}/settings`)),
  ...(await listDocumentNames(token, `${base}/rankings`)),
  `projects/${projectId}/databases/(default)/documents/${base}`
];

await commitDeletes(token, names);
console.log(`Deleted ${names.length} documents from ${projectId}/${base}`);
