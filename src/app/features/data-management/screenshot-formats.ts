export type ScreenshotFormat = {
  label: string;
  mimeType: string;
  extensions: string[];
};

const screenshotFormatAliases: Record<string, ScreenshotFormat> = {
  png: { label: 'PNG', mimeType: 'image/png', extensions: ['.png'] },
  jpeg: { label: 'JPEG', mimeType: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
  jpg: { label: 'JPEG', mimeType: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
  gif: { label: 'GIF', mimeType: 'image/gif', extensions: ['.gif'] },
  bmp: { label: 'BMP', mimeType: 'image/bmp', extensions: ['.bmp'] },
  webp: { label: 'WEBP', mimeType: 'image/webp', extensions: ['.webp'] },
};

export function screenshotFormatsFromCapability(
  value: string | null | undefined,
): ScreenshotFormat[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => toScreenshotFormat(item))
    .filter((format): format is ScreenshotFormat => format !== null)
    .filter(
      (format, index, all) =>
        all.findIndex((candidate) => candidate.mimeType === format.mimeType) === index,
    );
}

export function screenshotAcceptTypes(supportedFormats: ScreenshotFormat[]): string[] {
  return supportedFormats
    .flatMap((format) => [format.mimeType, ...format.extensions])
    .filter((value, index, all) => all.indexOf(value) === index);
}

export function isSupportedScreenshotType(
  file: File,
  supportedFormats: ScreenshotFormat[],
): boolean {
  const mimeType = file.type.trim().toLowerCase();
  const extension = fileExtension(file.name);

  return supportedFormats.some(
    (format) =>
      format.mimeType === mimeType || (extension !== null && format.extensions.includes(extension)),
  );
}

export function supportedScreenshotFormatLabels(supportedFormats: ScreenshotFormat[]): string {
  return supportedFormats
    .map((format) => format.label)
    .filter((label, index, all) => all.indexOf(label) === index)
    .join(', ');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function toScreenshotFormat(value: string): ScreenshotFormat | null {
  const normalizedValue = value.trim().toLowerCase();
  const key = normalizedValue.replace(/^image\//, '').replace(/^\./, '');

  return screenshotFormatAliases[key] ?? null;
}

function fileExtension(fileName: string): string | null {
  const match = /\.[^.]+$/.exec(fileName.trim().toLowerCase());
  return match?.[0] ?? null;
}
