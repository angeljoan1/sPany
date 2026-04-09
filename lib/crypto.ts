const str2ab = (str: string) =>
  new TextEncoder().encode(str)

const ab2b64 = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))

const b642ab = (b64: string) =>
  Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer

// Derives an AES-256 key from a PIN using PBKDF2 (310k iterations)
export async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', str2ab(pin), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

// Generates a random AES-256 vault key
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  )
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return ab2b64(raw)
}

export async function importKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', b642ab(b64), { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  )
}

// Encrypts a string. Prepends the random IV to the ciphertext before encoding.
export async function encrypt(text: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, str2ab(text)
  )
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.byteLength)
  return ab2b64(combined.buffer)
}

// Decrypts a string. Expects IV prepended to the ciphertext (see encrypt).
export async function decrypt(b64: string, key: CryptoKey): Promise<string> {
  const combined = new Uint8Array(b642ab(b64))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, key, data
  )
  return new TextDecoder().decode(decrypted)
}