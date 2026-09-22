/**
 * Download a binary asset while reporting bytes, and hand back a `blob:` URL
 * the loader can read from memory.
 *
 * The boot screen's memory test counts against this number, and it is the one
 * thing on that screen that is not theatre — so it has to be the actual model
 * coming down, not a timer. `useGLTF` has no progress hook, and letting the
 * loader fetch the same URL again would double the download wherever the cache
 * headers say so; parsing from a blob never touches the network twice.
 *
 * Content-Length goes missing when a proxy compresses on the fly, so the caller
 * passes the size it expects and the readout still moves; it lands at 1 when
 * the stream closes either way.
 */
export async function downloadWithProgress(
  url: string,
  onProgress: (fraction: number) => void,
  expectedBytes = 0
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`);

  const total = Number(res.headers.get("content-length")) || expectedBytes;
  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    // Hold just short of 1 until the stream is actually closed.
    if (total > 0) onProgress(Math.min(received / total, 0.995));
  }
  onProgress(1);

  const type = res.headers.get("content-type") || "application/octet-stream";
  return URL.createObjectURL(new Blob(chunks, { type }));
}
