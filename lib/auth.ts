import { supabase } from './supabase'
import { deriveKey, generateVaultKey, exportKey, importKey, encrypt, decrypt } from './crypto'

function getSalt(username: string): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(username.padEnd(16, '0').slice(0, 16))
  const buf = new ArrayBuffer(16)
  new Uint8Array(buf).set(encoded)
  return new Uint8Array(buf) as unknown as Uint8Array<ArrayBuffer>
}

async function hashPin(pin: string, username: string): Promise<string> {
  const data = new TextEncoder().encode(pin + username)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

export async function checkUserExists(username: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single()
  return !!data
}

export async function getUsers(): Promise<string[]> {
  const { data } = await supabase
    .from('users')
    .select('username')
    .order('created_at', { ascending: true })
  return data ? data.map((u) => u.username) : []
}

export async function register(username: string, pin: string): Promise<CryptoKey> {
  const pinHash = await hashPin(pin, username)
  const salt = getSalt(username)
  const pinKey = await deriveKey(pin, salt)
  const vaultKey = await generateVaultKey()
  const vaultKeyB64 = await exportKey(vaultKey)
  
  const encryptedVaultKey = await encrypt(vaultKeyB64, pinKey)

  const { error } = await supabase.from('users').insert({
    username,
    pin_hash: pinHash,
    encrypted_vault_key: encryptedVaultKey,
  })

  if (error) throw new Error(error.message)

  return vaultKey // Devolvemos la llave para que page.tsx se encargue del resto
}

export async function login(username: string, pin: string): Promise<CryptoKey> {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single()

  if (error || !user) throw new Error('Usuari no trobat')

  const pinHash = await hashPin(pin, username)
  if (pinHash !== user.pin_hash) throw new Error('PIN incorrecte')

  const salt = getSalt(username)
  const pinKey = await deriveKey(pin, salt)
  const vaultKeyB64 = await decrypt(user.encrypted_vault_key, pinKey)
  return importKey(vaultKeyB64)
}

