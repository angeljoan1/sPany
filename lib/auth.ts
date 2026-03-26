import { supabase } from './supabase'
import { deriveKey, generateVaultKey, exportKey, importKey, encrypt } from './crypto'

// El salt lo guardamos fijo por usuario, derivado de su username
// En una app más compleja se guardaría en BD, aquí lo simplificamos
function getSalt(username: string): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(username.padEnd(16, '0').slice(0, 16))
  return encoded.buffer instanceof ArrayBuffer
    ? new Uint8Array(encoded.buffer as ArrayBuffer)
    : new Uint8Array(Array.from(encoded)) as unknown as Uint8Array<ArrayBuffer>
}

// Hash del PIN para verificación rápida (no es la clave de cifrado)
async function hashPin(pin: string, username: string): Promise<string> {
  const data = new TextEncoder().encode(pin + username)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

export async function register(username: string, pin: string, adminPublicKey: string) {
  // 1. Hash del PIN para verificar login (no sirve para cifrar)
  const pinHash = await hashPin(pin, username)

  // 2. Deriva clave AES del PIN
  const salt = getSalt(username)
  const pinKey = await deriveKey(pin, salt)

  // 3. Genera vault key aleatoria (esta cifra los datos reales)
  const vaultKey = await generateVaultKey()
  const vaultKeyB64 = await exportKey(vaultKey)

  // 4. Cifra la vault key con la clave del PIN
  const encryptedVaultKey = await encrypt(vaultKeyB64, pinKey)

  // 5. Cifra la vault key con la clave de admin (para recovery)
  const adminKey = await importKey(adminPublicKey)
  const adminEncryptedVaultKey = await encrypt(vaultKeyB64, adminKey)

  // 6. Guarda en Supabase
  const { error } = await supabase.from('users').insert({
    username,
    pin_hash: pinHash,
    encrypted_vault_key: encryptedVaultKey,
    admin_encrypted_vault_key: adminEncryptedVaultKey,
  })

  if (error) throw new Error(error.message)
}

export async function login(username: string, pin: string): Promise<CryptoKey> {
  // 1. Busca el usuario
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single()

  if (error || !user) throw new Error('Usuario no encontrado')

  // 2. Verifica el PIN
  const pinHash = await hashPin(pin, username)
  if (pinHash !== user.pin_hash) throw new Error('PIN incorrecto')

  // 3. Deriva la clave del PIN y descifra la vault key
  const salt = getSalt(username)
  const pinKey = await deriveKey(pin, salt)

  const { decrypt } = await import('./crypto')
  const vaultKeyB64 = await decrypt(user.encrypted_vault_key, pinKey)
  const vaultKey = await importKey(vaultKeyB64)

  return vaultKey
}

// Solo para uso del admin — recuperar vault key de un usuario
export async function adminRecoverVaultKey(
  username: string,
  adminKey: CryptoKey
): Promise<string> {
  const { data: user, error } = await supabase
    .from('users')
    .select('admin_encrypted_vault_key')
    .eq('username', username)
    .single()

  if (error || !user) throw new Error('Usuario no encontrado')

  const { decrypt } = await import('./crypto')
  return decrypt(user.admin_encrypted_vault_key, adminKey)
}

// Resetea el PIN de un usuario (flujo de recovery)
export async function adminResetPin(
  username: string,
  newPin: string,
  adminKey: CryptoKey
) {
  // 1. Recupera la vault key original via admin
  const vaultKeyB64 = await adminRecoverVaultKey(username, adminKey)

  // 2. Re-cifra con el nuevo PIN
  const salt = getSalt(username)
  const newPinKey = await deriveKey(newPin, salt)
  const { encrypt } = await import('./crypto')
  const newEncryptedVaultKey = await encrypt(vaultKeyB64, newPinKey)
  const newPinHash = await hashPin(newPin, username)

  // 3. Actualiza en Supabase
  const { error } = await supabase
    .from('users')
    .update({
      pin_hash: newPinHash,
      encrypted_vault_key: newEncryptedVaultKey,
    })
    .eq('username', username)

  if (error) throw new Error(error.message)
}