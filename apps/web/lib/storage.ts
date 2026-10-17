import crypto from "node:crypto";
import { env } from "./env";

export class StorageNoConfiguradoError extends Error {
  constructor(
    message = "El almacenamiento de archivos no está configurado todavía",
  ) {
    super(message);
    this.name = "StorageNoConfiguradoError";
  }
}

/**
 * Indica si las credenciales de Object Storage (Neon / S3) están presentes.
 */
export function isStorageConfigured(): boolean {
  return Boolean(
    env.STORAGE_BUCKET &&
      env.STORAGE_ACCESS_KEY_ID &&
      env.STORAGE_SECRET_ACCESS_KEY,
  );
}

/**
 * Genera una firma AWS Signature Version 4 para una petición PUT a un bucket S3 compatible.
 */
function signAwsV4Put(params: {
  method: string;
  url: URL;
  headers: Record<string, string>;
  payloadHash: string;
  region: string;
  service: string;
  accessKey: string;
  secretKey: string;
  dateStr: string;
  timeStr: string;
}): string {
  const {
    method,
    url,
    headers,
    payloadHash,
    region,
    service,
    accessKey,
    secretKey,
    dateStr,
    timeStr,
  } = params;

  // 1. Canonical Headers
  const sortedHeaderKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();

  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${(headers[k] ?? "").trim()}\n`)
    .join("");

  const signedHeaders = sortedHeaderKeys.join(";");

  // 2. Canonical Request
  const canonicalRequest = [
    method,
    url.pathname,
    url.search ? url.search.slice(1) : "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const canonicalRequestHash = crypto
    .createHash("sha256")
    .update(canonicalRequest, "utf8")
    .digest("hex");

  // 3. String to Sign
  const credentialScope = `${dateStr}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timeStr,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  // 4. Signing Key calculation
  const kDate = crypto
    .createHmac("sha256", `AWS4${secretKey}`)
    .update(dateStr)
    .digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
  const kService = crypto
    .createHmac("sha256", kRegion)
    .update(service)
    .digest();
  const kSigning = crypto
    .createHmac("sha256", kService)
    .update("aws4_request")
    .digest();

  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  return `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

/**
 * Sube un archivo a Object Storage bajo una subcarpeta dada y devuelve su URL pública accesible.
 */
async function uploadToStorage(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  folder: string,
): Promise<string> {
  if (!isStorageConfigured()) {
    throw new StorageNoConfiguradoError();
  }

  const bucket = env.STORAGE_BUCKET;
  const accessKey = env.STORAGE_ACCESS_KEY_ID;
  const secretKey = env.STORAGE_SECRET_ACCESS_KEY;
  if (!bucket || !accessKey || !secretKey) {
    throw new StorageNoConfiguradoError();
  }
  const region = env.STORAGE_REGION || "us-east-1";

  // Generamos un nombre único y sanitizado
  const ext = filename.split(".").pop()?.toLowerCase() || "png";
  const uniqueKey = `merchants/${folder}/${crypto.randomUUID()}.${ext}`;

  // Determinamos el host y endpoint S3
  let host = `${bucket}.s3.${region}.amazonaws.com`;
  let targetUrl = `https://${host}/${uniqueKey}`;

  if (env.STORAGE_ENDPOINT) {
    const customEndpoint = env.STORAGE_ENDPOINT.replace(/\/$/, "");
    const parsed = new URL(customEndpoint);
    host = parsed.host;
    targetUrl = `${customEndpoint}/${bucket}/${uniqueKey}`;
  }

  const url = new URL(targetUrl);
  const now = new Date();
  const timeStr = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStr = timeStr.slice(0, 8);

  const payloadHash = crypto.createHash("sha256").update(buffer).digest("hex");

  const headers: Record<string, string> = {
    host,
    "content-type": mimeType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": timeStr,
  };

  const authHeader = signAwsV4Put({
    method: "PUT",
    url,
    headers,
    payloadHash,
    region,
    service: "s3",
    accessKey,
    secretKey,
    dateStr,
    timeStr,
  });

  headers.Authorization = authHeader;

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers,
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Error al subir archivo a Object Storage (${res.status}): ${errorText}`,
    );
  }

  if (env.STORAGE_PUBLIC_URL) {
    return `${env.STORAGE_PUBLIC_URL.replace(/\/$/, "")}/${uniqueKey}`;
  }

  return targetUrl;
}

/**
 * Sube el archivo de logo a Object Storage y devuelve su URL pública accesible.
 */
export async function uploadLogo(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  return uploadToStorage(buffer, mimeType, filename, "logos");
}

/**
 * Sube el archivo de banner hero a Object Storage y devuelve su URL pública accesible.
 */
export async function uploadHero(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  return uploadToStorage(buffer, mimeType, filename, "heroes");
}
