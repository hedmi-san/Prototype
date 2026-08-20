/**
 * Extracts a filename from the HTTP Content-Disposition response header.
 */
export function extractFilename(contentDisposition?: string, fallback = 'export.csv'): string {
  if (!contentDisposition) return fallback;

  const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  if (match && match[1]) {
    return decodeURIComponent(match[1].trim());
  }

  return fallback;
}

/**
 * Triggers a browser download of a Blob file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Helper to download CSV from an Axios response with responseType: 'blob'.
 */
export function downloadCsvResponse(response: { data: Blob; headers: any }, defaultFilename = 'export.csv'): void {
  const filename = extractFilename(
    response.headers?.['content-disposition'] || response.headers?.['Content-Disposition'],
    defaultFilename
  );
  downloadBlob(response.data, filename);
}
