'use server'

import { supabase } from './supabase'
import { deriveKey, encrypt, decrypt } from './crypto'

// --- Utilidades Internas del Servidor ---
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

// Recreamos la llave del admin de forma 100% segura y oculta
async function getAdminKey(): Promise<CryptoKey> {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) throw new Error("Falta la contraseña de administrador")
  
  const salt = getSalt('admin_master')
  return await deriveKey(adminPassword, salt)
}


// --- Acciones de Administrador (Server Actions) ---

export async function createAdminBackup(username: string, vaultKeyB64: string) {
  try {
    const adminKey = await getAdminKey()
    const adminEncryptedVaultKey = await encrypt(vaultKeyB64, adminKey)

    const { error } = await supabase
      .from('users')
      .update({ admin_encrypted_vault_key: adminEncryptedVaultKey })
      .eq('username', username)

    if (error) throw new Error(error.message)
    
    // Si todo va bien, devolvemos un objeto de éxito
    return { success: true }
    
  } catch (error: any) {
    // Si algo falla, lo capturamos y devolvemos el texto del error
    console.error("Error interno en el servidor:", error)
    return { error: error.message || "Error desconocido en el servidor" }
  }
}

// Mudamos el reseteo aquí para que use la contraseña secreta
export async function adminResetPin(username: string, newPin: string): Promise<void> {
  const { data: user, error } = await supabase
    .from('users')
    .select('admin_encrypted_vault_key')
    .eq('username', username)
    .single()

  if (error || !user) throw new Error('Usuari no trobat')

  // 1. Desciframos con la llave maestra oculta
  const adminKey = await getAdminKey()
  const vaultKeyB64 = await decrypt(user.admin_encrypted_vault_key, adminKey)
  
  // 2. Preparamos el nuevo PIN
  const salt = getSalt(username)
  const newPinKey = await deriveKey(newPin, salt)
  
  // 3. Volvemos a cifrar la bóveda con el nuevo PIN
  const newEncryptedVaultKey = await encrypt(vaultKeyB64, newPinKey)
  const newPinHash = await hashPin(newPin, username)

  // 4. Guardamos los cambios
  const { error: updateError } = await supabase
    .from('users')
    .update({
      pin_hash: newPinHash,
      encrypted_vault_key: newEncryptedVaultKey,
    })
    .eq('username', username)

  if (updateError) throw new Error(updateError.message)
}