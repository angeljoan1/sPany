// Convierte string a ArrayBuffer
const str2ab = (str: string) =>
  new TextEncoder().encode(str)

// Convierte ArrayBuffer a base64
const ab2b64 = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))

// Convierte base64 a ArrayBuffer
const b642ab = (b64: string) =>
  Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer

// Deriva una clave AES-256 a partir de un PIN
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

// Genera una vault key aleatoria
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  )
}

// Exporta una CryptoKey a base64
export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return ab2b64(raw)
}

// Importa una CryptoKey desde base64
export async function importKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', b642ab(b64), { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  )
}

// Cifra un string con una CryptoKey
export async function encrypt(text: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, str2ab(text)
  )
  // Guardamos iv + datos cifrados juntos en base64
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.byteLength)
  return ab2b64(combined.buffer)
}

// Descifra un string con una CryptoKey
export async function decrypt(b64: string, key: CryptoKey): Promise<string> {
  const combined = new Uint8Array(b642ab(b64))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, key, data
  )
  return new TextDecoder().decode(decrypted)
}