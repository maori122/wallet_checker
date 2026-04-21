const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveUserKey(masterKey: string, userId: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterKey),
    "HKDF",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(`wallet-user-salt:${userId}`),
      info: encoder.encode("wallet-field-encryption")
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptForUser(
  plaintext: string,
  userId: string,
  masterKey: string
): Promise<string> {
  const key = await deriveUserKey(masterKey, userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    encoder.encode(plaintext)
  );

  const packed = `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
  return packed;
}

export async function decryptForUser(
  packedCiphertext: string,
  userId: string,
  masterKey: string
): Promise<string> {
  const [ivB64, dataB64] = packedCiphertext.split(".");
  if (!ivB64 || !dataB64) {
    throw new Error("Invalid encrypted payload format");
  }

  const key = await deriveUserKey(masterKey, userId);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(fromBase64(ivB64))
    },
    key,
    toArrayBuffer(fromBase64(dataB64))
  );
  return decoder.decode(plaintext);
}

export async function addressHash(normalizedAddress: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(normalizedAddress));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
