export async function compressImageFile(
  file: File,
  opts?: { maxEdge?: number; maxBytes?: number; quality?: number },
): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  const maxEdge = opts?.maxEdge ?? 1920;
  const maxBytes = opts?.maxBytes ?? 450_000;
  const quality = opts?.quality ?? 0.72;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const primary = canvas.toDataURL("image/jpeg", quality);
  if (primary.length <= maxBytes) return primary;
  const tighter = canvas.toDataURL("image/jpeg", Math.min(quality, 0.55));
  if (tighter.length <= maxBytes) return tighter;
  return null;
}

export function compressMemberPhoto(file: File) {
  return compressImageFile(file, { maxEdge: 384, maxBytes: 180_000, quality: 0.82 });
}
