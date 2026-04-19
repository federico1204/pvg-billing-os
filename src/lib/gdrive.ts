import { google } from "googleapis";

type DriveClient = ReturnType<typeof google.drive>;

let _drive: DriveClient | null = null;

function makeDriveClient(credsJson: string): DriveClient {
  const creds = JSON.parse(credsJson);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
  return google.drive({ version: "v3", auth });
}

async function getDrive(): Promise<DriveClient> {
  if (_drive) return _drive;

  // Try primary account first, fall back to secondary
  const primary = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const fallback = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_FALLBACK;

  if (primary) {
    try {
      const client = makeDriveClient(primary);
      // Quick probe to validate access
      await client.files.list({ pageSize: 1, fields: "files(id)" });
      _drive = client;
      return _drive;
    } catch {
      // primary failed, try fallback
    }
  }

  if (fallback) {
    const client = makeDriveClient(fallback);
    _drive = client;
    return _drive;
  }

  throw new Error("No valid Google service account configured");
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  modifiedTime: string;
}

export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  const drive = await getDrive();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,size,createdTime,modifiedTime)",
    orderBy: "createdTime desc",
    pageSize: 200,
  });
  return (res.data.files ?? []) as DriveFile[];
}

export async function downloadFileAsBuffer(fileId: string): Promise<Buffer> {
  const drive = await getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function exportGoogleDocAsPDF(fileId: string): Promise<Buffer> {
  const drive = await getDrive();
  const res = await drive.files.export(
    { fileId, mimeType: "application/pdf" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}
