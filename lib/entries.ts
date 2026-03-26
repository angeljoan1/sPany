import { supabase } from './supabase'
import { encrypt, decrypt } from './crypto'

export interface Entry {
  id?: string
  service: string
  username: string
  password: string
  notes?: string
}

// Obtiene el user_id a partir del username
async function getUserId(username: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single()

  if (error || !data) throw new Error('Usuario no encontrado')
  return data.id
}

// Guarda una entrada nueva
export async function createEntry(
  username: string,
  entry: Entry,
  vaultKey: CryptoKey
): Promise<void> {
  const userId = await getUserId(username)
  const encryptedData = await encrypt(JSON.stringify(entry), vaultKey)

  const { error } = await supabase.from('entries').insert({
    user_id: userId,
    encrypted_data: encryptedData,
  })

  if (error) throw new Error(error.message)
}

// Obtiene y descifra todas las entradas de un usuario
export async function getEntries(
  username: string,
  vaultKey: CryptoKey
): Promise<Entry[]> {
  const userId = await getUserId(username)

  const { data, error } = await supabase
    .from('entries')
    .select('id, encrypted_data')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  if (!data) return []

  const entries = await Promise.all(
    data.map(async (row) => {
      const decrypted = await decrypt(row.encrypted_data, vaultKey)
      const entry = JSON.parse(decrypted) as Entry
      return { ...entry, id: row.id }
    })
  )

  return entries
}

// Actualiza una entrada existente
export async function updateEntry(
  entryId: string,
  entry: Entry,
  vaultKey: CryptoKey
): Promise<void> {
  const encryptedData = await encrypt(JSON.stringify(entry), vaultKey)

  const { error } = await supabase
    .from('entries')
    .update({
      encrypted_data: encryptedData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)

  if (error) throw new Error(error.message)
}

// Borra una entrada
export async function deleteEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', entryId)

  if (error) throw new Error(error.message)
}

// Exporta todas las entradas como JSON cifrado (backup portable)
export async function exportVault(
  username: string,
  vaultKey: CryptoKey
): Promise<string> {
  const entries = await getEntries(username, vaultKey)
  const json = JSON.stringify(entries, null, 2)
  const encrypted = await encrypt(json, vaultKey)
  return encrypted
}

// Importa entradas desde un backup
export async function importVault(
  username: string,
  encryptedBackup: string,
  vaultKey: CryptoKey
): Promise<void> {
  const json = await decrypt(encryptedBackup, vaultKey)
  const entries = JSON.parse(json) as Entry[]

  for (const entry of entries) {
    const { id, ...entryWithoutId } = entry
    await createEntry(username, entryWithoutId, vaultKey)
  }
}