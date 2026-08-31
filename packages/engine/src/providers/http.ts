/** Downloads a remote render so it can be stored alongside every other one. */
export async function fetchAsBase64(url: string): Promise<{ data: string; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download the generated image: ${res.status}`);
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const buffer = await res.arrayBuffer();
  return { data: Buffer.from(buffer).toString("base64"), mime };
}
