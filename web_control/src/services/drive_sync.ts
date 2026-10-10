/**
 * Google Drive appDataFolder Zero-Cost Persistence Sync Service
 * File: web_control/src/services/drive_sync.ts
 * 
 * Leverages Google Drive's free 15GB tier and appDataFolder scope
 * (https://www.googleapis.com/auth/drive.appdata).
 * Zero payment cards required.
 * Allows client-side backup and restore of configurations and local state.
 */

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export class GoogleDriveSyncService {
  private static DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  private static DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

  /**
   * Lists files saved in the user's hidden appDataFolder.
   */
  public static async listAppFiles(accessToken: string): Promise<DriveFileMetadata[]> {
    if (!accessToken) throw new Error("Google Drive access token missing");

    const query = encodeURIComponent("'appDataFolder' in parents and trashed = false");
    const res = await fetch(`${this.DRIVE_FILES_URL}?spaces=appDataFolder&q=${query}&fields=files(id,name,mimeType,modifiedTime)`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Drive list failed: ${res.statusText}`);
    }

    const data = await res.json();
    return data.files || [];
  }

  /**
   * Uploads or updates a file inside the user's appDataFolder.
   */
  public static async saveAppFile(
    fileName: string,
    content: string | object,
    accessToken: string,
    mimeType: string = "application/json"
  ): Promise<string> {
    if (!accessToken) throw new Error("Google Drive access token missing");

    const textContent = typeof content === "string" ? content : JSON.stringify(content, null, 2);

    // 1. Check if file already exists in appDataFolder
    const existingFiles = await this.listAppFiles(accessToken);
    const existing = existingFiles.find((f) => f.name === fileName);

    const metadata = {
      name: fileName,
      mimeType: mimeType,
      parents: ["appDataFolder"],
    };

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n` +
      textContent +
      closeDelimiter;

    let targetUrl = this.DRIVE_UPLOAD_URL;
    let method = "POST";

    if (existing) {
      targetUrl = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`;
      method = "PATCH";
    }

    const res = await fetch(targetUrl, {
      method: method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!res.ok) {
      throw new Error(`Drive sync failed: ${res.statusText}`);
    }

    const data = await res.json();
    return data.id;
  }

  /**
   * Reads a file content from appDataFolder by file ID or file name.
   */
  public static async readAppFile(
    identifier: string,
    accessToken: string
  ): Promise<string> {
    if (!accessToken) throw new Error("Google Drive access token missing");

    let fileId = identifier;

    // If identifier is a name, look up fileId
    if (!identifier.startsWith("1") && identifier.includes(".")) {
      const files = await this.listAppFiles(accessToken);
      const match = files.find((f) => f.name === identifier);
      if (!match) throw new Error(`File ${identifier} not found in appDataFolder`);
      fileId = match.id;
    }

    const res = await fetch(`${this.DRIVE_FILES_URL}/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Drive read failed: ${res.statusText}`);
    }

    return await res.text();
  }
}
