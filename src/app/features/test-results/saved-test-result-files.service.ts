import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap, throwError } from 'rxjs';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import type { Artifact } from '../../generated/hateoas/types.gen';
import type { TestRunDetailsView } from './test-result-details.models';

@Injectable({ providedIn: 'root' })
export class SavedTestResultFilesService {
  private readonly context = inject(WorkspaceContextService);

  savedFileCount(details: TestRunDetailsView): number {
    return details.testSets.reduce(
      (testSetTotal, testSet) =>
        testSetTotal +
        testSet.paths.reduce(
          (pathTotal, path) =>
            pathTotal +
            path.artifacts.length +
            path.actions.filter((action) => action.screenshotBlob !== null).length,
          0,
        ),
      0,
    );
  }

  downloadSavedFiles(details: TestRunDetailsView): Observable<void> {
    const entries = this.savedFileEntries(details);

    if (entries.length === 0) {
      return throwError(() => new Error('This test run has no saved files to download.'));
    }

    const artifactRequests = entries.filter(
      (entry): entry is SavedFileRequest => entry.kind === 'request',
    );
    const artifactDownloads = artifactRequests.map((entry) =>
      this.context.fetchBlob(entry.url).pipe(
        map((blob: Blob) => ({
          path: entry.path,
          blob,
        })),
      ),
    );
    const screenshotFiles = entries
      .filter((entry): entry is SavedFileBlob => entry.kind === 'blob')
      .map((entry) => ({
        path: entry.path,
        blob: entry.blob,
      }));
    const request = artifactDownloads.length > 0 ? forkJoin(artifactDownloads) : of([]);

    return request.pipe(
      switchMap((artifactFiles) => buildZip([...screenshotFiles, ...artifactFiles])),
      map((zip) => this.downloadBlob(zip, `test-run-${details.result.id ?? 'result'}-files.zip`)),
    );
  }

  private savedFileEntries(details: TestRunDetailsView): SavedFileEntry[] {
    const entries: SavedFileEntry[] = [];

    details.testSets.forEach((testSet, testSetIndex) => {
      const testSetId = testSet.result.id ?? testSetIndex + 1;

      testSet.paths.forEach((path, pathIndex) => {
        const pathId = path.result.id ?? pathIndex + 1;
        const basePath = `browser-${testSetId}/path-${pathId}`;

        path.actions.forEach((action, actionIndex) => {
          if (action.screenshotBlob === null) {
            return;
          }

          const actionId = action.result.id ?? actionIndex + 1;
          entries.push({
            kind: 'blob',
            path: `${basePath}/screenshots/action-${actionId}.png`,
            blob: action.screenshotBlob,
          });
        });

        path.artifacts.forEach((artifactView) => {
          if (!artifactView.downloadUrl) {
            return;
          }

          entries.push({
            kind: 'request',
            path: `${basePath}/artifacts/${this.fileName(artifactView.artifact)}`,
            url: artifactView.downloadUrl,
          });
        });
      });
    });

    return entries;
  }

  private fileName(artifact: Artifact): string {
    return this.sanitizeFileName(
      artifact.filename?.trim() || `artifact-${artifact.id ?? 'download'}`,
    );
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}

type SavedFileBlob = {
  kind: 'blob';
  path: string;
  blob: Blob;
};

type SavedFileRequest = {
  kind: 'request';
  path: string;
  url: string;
};

type SavedFileEntry = SavedFileBlob | SavedFileRequest;

type ZipEntry = {
  path: string;
  blob: Blob;
};

async function buildZip(entries: ZipEntry[]): Promise<Blob> {
  const encodedEntries = await Promise.all(
    entries.map(async (entry) => ({
      path: encodeZipPath(entry.path),
      data: new Uint8Array(await entry.blob.arrayBuffer()),
    })),
  );
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const entry of encodedEntries) {
    const crc = crc32(entry.data);
    const localHeader = zipLocalHeader(entry.path, entry.data.length, crc);
    const centralHeader = zipCentralHeader(entry.path, entry.data.length, crc, offset);

    chunks.push(localHeader, entry.data);
    centralDirectory.push(centralHeader);
    offset += localHeader.length + entry.data.length;
  }

  const centralDirectoryOffset = offset;
  chunks.push(...centralDirectory);
  offset += centralDirectory.reduce((total, chunk) => total + chunk.length, 0);
  chunks.push(
    zipEndOfCentralDirectory(
      encodedEntries.length,
      offset - centralDirectoryOffset,
      centralDirectoryOffset,
    ),
  );

  return new Blob(chunks.map(toArrayBuffer), {
    type: 'application/zip',
  });
}

function toArrayBuffer(chunk: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(chunk.byteLength);
  new Uint8Array(buffer).set(chunk);
  return buffer;
}

function encodeZipPath(path: string): Uint8Array {
  return new TextEncoder().encode(path.replace(/^\/+/, ''));
}

function zipLocalHeader(path: Uint8Array, size: number, crc: number): Uint8Array {
  const header = new Uint8Array(30 + path.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 2048, true);
  view.setUint16(8, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, path.length, true);
  header.set(path, 30);
  return header;
}

function zipCentralHeader(path: Uint8Array, size: number, crc: number, offset: number): Uint8Array {
  const header = new Uint8Array(46 + path.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 2048, true);
  view.setUint16(10, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, path.length, true);
  view.setUint32(42, offset, true);
  header.set(path, 46);
  return header;
}

function zipEndOfCentralDirectory(
  entries: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number,
): Uint8Array {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entries, true);
  view.setUint16(10, entries, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  return header;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});
