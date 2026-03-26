'use client'
/* eslint-disable @next/next/no-img-element */

import React, { useState, useCallback, useEffect } from 'react'
import {
  Eye, EyeOff, Copy, Edit2, Trash2,
  ArrowLeft, Plus, Search, Download, RefreshCw, Delete,
} from 'lucide-react'
import { register, login, checkUserExists, getUsers } from '@/lib/auth'
import { getEntries, createEntry, updateEntry, deleteEntry, exportVault, importVault } from '@/lib/entries'
import { createAdminBackup } from '@/lib/admin-actions'
import { exportKey } from '@/lib/crypto'


interface Entry {
  id: string
  service: string
  username: string
  password: string
  notes: string
}

interface EditingEntry {
  id: string | undefined
  service: string
  username: string
  password: string
  notes: string
}

type Screen = 'loading' | 'enter_username' | 'login' | 'list' | 'edit'

export default function PasswordManager() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [username, setUsername] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter')
  const [pinError, setPinError] = useState(false)
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [editingEntry, setEditingEntry] = useState<EditingEntry>({
    id: undefined, service: '', username: '', password: '', notes: '',
  })
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function init() {
      const saved = localStorage.getItem('claus_username')
      if (saved) {
        // Si ya ha entrado antes, le pedimos el PIN directamente
        setUsername(saved)

        // Asumimos que no es nuevo porque ya estaba en localStorage
        // Si por algún casual borraran al usuario de la BD pero no del móvil, 
        // el login fallará y ya gestionaremos ese error.
        setIsNewUser(false)
        setScreen('login')
      } else {
        // Si es la primera vez o borró la caché, le pedimos el nombre
        setScreen('enter_username')
      }
    }
    init()
  }, [])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const showError = useCallback(() => {
    setPinError(true)
    setTimeout(() => setPinError(false), 500)
  }, [])

  // 1. doUnlock ahora avisa en consola si algo falla en vez de fallar en silencio
  const doUnlock = useCallback(async (finalPin: string, finalConfirm: string, newUser: boolean, step: 'enter' | 'confirm') => {
    if (newUser && step === 'enter') return

    try {
      if (newUser) {
        if (finalPin !== finalConfirm) {
          showError()
          setPinStep('enter')
          setConfirmPin('')
          setPin('')
          return
        }

        // --- AQUÍ EMPIEZA EL CÓDIGO NUEVO INTEGRADO ---
        console.log("Creando bóveda cifrada...")
        const key = await register(username, finalPin)

        console.log("Enviando copia de seguridad al servidor...")
        const vaultKeyB64 = await exportKey(key)

        // --- CÓDIGO ACTUALIZADO AQUÍ ---
        const backupResult = await createAdminBackup(username, vaultKeyB64)

        if (backupResult?.error) {
          // Si el servidor nos devuelve un error, lanzamos la excepción con el mensaje REAL
          throw new Error(`Fallo en backup: ${backupResult.error}`)
        }


        console.log("Copia de seguridad guardada con éxito.")
        localStorage.setItem('claus_username', username)
        setVaultKey(key)
        setEntries([])
        setIsNewUser(false)  // Ya no es un usuario nuevo
        setPinStep('enter')  // Reseteamos el paso del PIN por si acaso
        setScreen('list')


      } else {
        console.log("Desbloqueando bóveda...")
        const key = await login(username, finalPin)
        localStorage.setItem('claus_username', username)
        const loaded = await getEntries(username, key)
        setVaultKey(key)
        setEntries(loaded as Entry[])
        setScreen('list')
      }
      setPin('')
    } catch (error) {
      // AQUÍ ESTÁ LA CLAVE: Si falla, lo veremos en la consola (F12)
      console.error("Error crítico en la autenticación/registro:", error)
      showError()
      if (newUser) {
        setPinStep('enter')
        setConfirmPin('')
      }
      setPin('')
    }
  }, [username, showError])

  // 2. handlePinPress ahora es una función "pura", sin lógicas raras
  const handlePinPress = useCallback((digit: string) => {
    setPin(prev => {
      if (prev.length >= 6) return prev
      return prev + digit
    })
  }, [])

  // 3. Este useEffect vigila el PIN y actúa SOLO cuando llega a 6 dígitos
  useEffect(() => {
    if (pin.length === 6) {
      const timer = setTimeout(() => {
        if (isNewUser && pinStep === 'enter') {
          setConfirmPin(pin)
          setPinStep('confirm')
          setPin('')
        } else {
          doUnlock(pin, confirmPin, isNewUser, pinStep)
        }
      }, 150)

      return () => clearTimeout(timer)
    }
  }, [pin, isNewUser, pinStep, confirmPin, doUnlock])

  const handleSelectUser = useCallback((name: string) => {
    setUsername(name)
    setIsNewUser(false)
    setPin('')
    setPinStep('enter')
    setConfirmPin('')
    setScreen('login')
  }, [])

  const handleUsernameSubmit = useCallback(async () => {
    const trimmedName = usernameInput.trim()
    if (!trimmedName) return

    // Le preguntamos a Supabase si este nombre existe
    const exists = await checkUserExists(trimmedName)

    setUsername(trimmedName)

    // Si NO existe, es un usuario nuevo (le pediremos crear PIN y confirmarlo).
    // Si SÍ existe, es un usuario antiguo (solo le pediremos el PIN una vez).
    setIsNewUser(!exists)

    setPinStep('enter')
    setPin('')
    setConfirmPin('')
    setScreen('login')
  }, [usernameInput])

  const handleSaveEntry = useCallback(async () => {
    if (!editingEntry.service || !editingEntry.username || !editingEntry.password) return
    if (!vaultKey) return
    if (editingEntry.id) {
      await updateEntry(editingEntry.id!, editingEntry, vaultKey)
      setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...editingEntry, id: editingEntry.id! } : e))
    } else {
      await createEntry(username, editingEntry, vaultKey)
      const loaded = await getEntries(username, vaultKey)
      setEntries(loaded as Entry[])
    }
    setScreen('list')
  }, [editingEntry, vaultKey, username])

  const handleDeleteEntry = useCallback(async (id: string) => {
    // Eliminamos la línea del confirm nativo de JavaScript
    await deleteEntry(id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setExpandedId(null)
    setEntryToDelete(null) // Esto cerrará nuestro modal personalizado
  }, [])

  const handleExport = useCallback(async () => {
    if (!vaultKey) return
    const encrypted = await exportVault(username, vaultKey)
    const blob = new Blob([encrypted], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'claus-backup.txt'
    a.click()
    URL.revokeObjectURL(url)
  }, [vaultKey, username])

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !vaultKey) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string
        const result = await importVault(username, content, vaultKey)
        showToast(`S'han importat ${result.count} claus correctament!`);
        const loaded = await getEntries(username, vaultKey)
        setEntries(loaded as Entry[])
      } catch (err: any) {
        alert(err.message)
      }
    }
    reader.readAsText(file)
    // Limpiamos el input para poder volver a usarlo
    e.target.value = ''
  }, [vaultKey, username])

  const handleGeneratePassword = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 16; i++) password += chars.charAt(Math.floor(Math.random() * chars.length))
    setEditingEntry(prev => ({ ...prev, password }))
  }, [])

  const filteredEntries = entries.filter(e =>
    e.service.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const PinDots = () => (
    <div className="flex justify-center gap-3 mb-10">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <div key={i} className="w-12 h-12 bg-white rounded-full border border-[rgba(26,26,26,0.08)] flex items-center justify-center text-xl text-[#1A1A1A]">
          {pin[i] ? '●' : '○'}
        </div>
      ))}
    </div>
  )

  const PinKeypad = () => (
    <>
      <div className="grid grid-cols-3 gap-3 mb-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            onClick={() => handlePinPress(String(num))}
            className="aspect-square bg-neutral-100 rounded-lg border border-[rgba(26,26,26,0.06)] text-lg font-semibold text-[#1A1A1A] hover:bg-neutral-200 transition-all duration-200 shadow-sm"
          >
            {num}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div />
        <button
          onClick={() => handlePinPress('0')}
          className="aspect-square bg-neutral-100 rounded-lg border border-[rgba(26,26,26,0.06)] text-lg font-semibold text-[#1A1A1A] hover:bg-neutral-200 transition-all duration-200 shadow-sm"
        >
          0
        </button>
        <button
          onClick={() => setPin(p => p.slice(0, -1))}
          className="aspect-square bg-gray-100 rounded-lg border border-[rgba(26,26,26,0.06)] text-gray-400 hover:bg-gray-200 transition-all duration-200 shadow-sm flex items-center justify-center"
        >
          <Delete size={20} />
        </button>
      </div>
    </>
  )

  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#999] text-sm">Carregant...</div>
      </div>
    )
  }


  if (screen === 'enter_username') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#F7F7F5] rounded-2xl p-8 border border-[rgba(26,26,26,0.06)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.06)]">
          <h1 className="text-3xl font-semibold text-[#1A1A1A] text-center mb-8">sPany</h1>
          <div className="flex justify-center mb-6">
            <img
              src="/icon-192.png"
              alt="Logo sPany"
              className="w-20 h-20 object-cover rounded-2xl shadow-sm border border-[rgba(26,26,26,0.06)]"
            />
          </div>
          <p className="text-sm text-[#999] text-center mb-6">Introdueix el teu usuari</p>
          <input
            type="text"
            value={usernameInput}
            onChange={e => setUsernameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUsernameSubmit()}
            placeholder="El teu nom"
            autoFocus
            className="w-full px-4 py-3 bg-white border border-[rgba(26,26,26,0.06)] rounded-xl text-[#1A1A1A] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:ring-opacity-20 transition-all duration-200 mb-4"
          />
          <button
            onClick={handleUsernameSubmit}
            className="w-full bg-[#1A1A1A] text-white font-semibold py-3 rounded-lg hover:bg-[#333] transition-all duration-200"
          >
            Continuar
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'login') {
    const title = isNewUser
      ? (pinStep === 'enter' ? 'Crea el teu PIN' : 'Confirma el PIN')
      : `Hola, ${username}`

    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className={`w-full max-w-sm bg-[#F7F7F5] rounded-2xl p-8 border border-[rgba(26,26,26,0.06)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.06)] transition-all duration-200 ${pinError ? 'animate-shake' : ''}`}>
          <h1 className="text-2xl font-semibold text-[#1A1A1A] text-center mb-2">{title}</h1>
          <div className="flex justify-center mb-6">
            <img
              src="/icon-192.png"
              alt="Logo sPany"
              className="w-20 h-20 object-cover rounded-2xl shadow-sm border border-[rgba(26,26,26,0.06)]"
            />
          </div>
          <p className="text-sm text-[#999] text-center mb-8">{isNewUser ? '6 dígits' : ' '}</p>
          <PinDots />
          <PinKeypad />
          <button
            onClick={() => {
              setPin('')
              setConfirmPin('')
              setPinStep('enter')
              // Simplemente volvemos a la pantalla de pedir el nombre
              setScreen('enter_username')
            }}
            className="w-full text-sm text-[#999] hover:text-[#1A1A1A] transition-colors duration-200 text-center"
          >
            ← Tornar
          </button>
        </div>
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
            20%, 40%, 60%, 80% { transform: translateX(8px); }
          }
          .animate-shake { animation: shake 0.5s; }
        `}</style>
      </div>
    )
  }

  if (screen === 'list') {
    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 bg-white border-b border-[rgba(26,26,26,0.06)] z-20">
          <div className="max-w-2xl mx-auto px-4 py-6 flex items-center justify-between">
            <button
              onClick={() => {
                // Destruimos la llave maestra en memoria por seguridad
                setVaultKey(null)
                setEntries([])
                setPin('')
                setScreen('login')
              }}
              title="Tancar sessió / Bloquejar"
              className="p-2 text-[#666] hover:bg-[#F7F7F5] rounded-lg transition-all duration-200"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-semibold text-[#1A1A1A]">sPany</h1>

            <button
              onClick={() => {
                setEditingEntry({ id: undefined, service: '', username: '', password: '', notes: '' })
                setShowPassword(false)
                setScreen('edit')
              }}
              title="Nova clau"
              className="p-2 text-[#1A1A1A] hover:bg-[#F7F7F5] rounded-lg transition-all duration-200"
            >
              <Plus size={24} />
            </button>
          </div>
          <div className="max-w-2xl mx-auto px-4 pb-6">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
              <input
                type="text"
                placeholder="Cerca un servei..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#F7F7F5] border border-[rgba(26,26,26,0.06)] rounded-lg text-[#1A1A1A] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:ring-opacity-20 transition-all duration-200"
              />
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
          {filteredEntries.map(entry => (
            <div key={entry.id} className="bg-[#F7F7F5] rounded-2xl border border-[rgba(26,26,26,0.06)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-200">
              <div
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                className="w-full p-4 flex items-start justify-between hover:bg-[#f0f0ed] transition-colors duration-200 cursor-pointer"
              >
                <div className="flex-1">
                  <div className="text-base font-semibold text-[#1A1A1A]">{entry.service}</div>
                  <div className="text-sm text-[#666] mt-1">{entry.username}</div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setEditingEntry({ id: entry.id, service: entry.service, username: entry.username, password: entry.password, notes: entry.notes })
                      setShowPassword(false)
                      setScreen('edit')
                    }}
                    className="p-2 text-[#666] hover:text-[#1A1A1A] transition-colors duration-200"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setEntryToDelete(entry.id) // Cambiamos esto
                    }}
                    className="p-2 text-[#666] hover:text-red-600 transition-colors duration-200"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {expandedId === entry.id && (
                <div className="border-t border-[rgba(26,26,26,0.06)] px-4 py-4 bg-white space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-[#999] uppercase tracking-wide">Usuari</label>
                    <div className="text-sm text-[#1A1A1A] mt-1 font-mono break-all">{entry.username}</div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#999] uppercase tracking-wide">Contrasenya</label>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="text-sm text-[#1A1A1A] font-mono flex-1 break-all">
                        {showPassword ? entry.password : '●'.repeat(entry.password.length)}
                      </div>
                      <button onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Amaga' : 'Mostra'} className="p-1 text-[#666] hover:text-[#1A1A1A] transition-colors duration-200">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      <button
                        onClick={() => { navigator.clipboard.writeText(entry.password); setCopiedId(entry.id); setTimeout(() => setCopiedId(null), 2000) }}
                        className="p-1 text-[#666] hover:text-[#1A1A1A] transition-colors duration-200"
                      >
                        {copiedId === entry.id ? <span className="text-xs font-semibold text-green-600">Copiat!</span> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>
                  {entry.notes && (
                    <div>
                      <label className="text-xs font-semibold text-[#999] uppercase tracking-wide">Notes</label>
                      <div className="text-sm text-[#666] mt-1">{entry.notes}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* ESTADO VACÍO */}
          {filteredEntries.length === 0 && (
            <div className="text-center py-20 flex flex-col items-center justify-center animate-in fade-in duration-500">
              <img
                src="/icon-192.png"
                alt="Bóveda buida"
                className="w-24 h-24 mb-6 opacity-20 grayscale mix-blend-multiply"
              />
              <div className="text-[#666] text-base font-medium">
                {entries.length === 0 ? 'La teva bóveda està buida' : 'Cap resultat trobat'}
              </div>
              <div className="text-[#999] text-sm mt-2 max-w-xs mx-auto">
                {entries.length === 0
                  ? 'Clica el botó + a dalt a la dreta per començar a guardar les teves claus de forma segura.'
                  : 'Prova a cercar amb unes altres paraules.'}
              </div>
            </div>
          )}
        </div>

        {/* PIE DE PÁGINA CON FIRMA Y EXPORTAR */}
        <div className="max-w-2xl mx-auto px-4 py-8 border-t border-[rgba(26,26,26,0.06)]">
          {/* AVISO PREVENTIVO */}
          <p className="text-[11px] text-[#999] mb-4 text-center uppercase tracking-widest font-medium">
            Recorda exportar una còpia cada vegada que afegeixis una clau
          </p>

          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <button onClick={handleExport} className="flex items-center gap-2 text-sm text-[#666] hover:text-[#1A1A1A] transition-colors duration-200">
                <Download size={16} />
                Exportar
              </button>

              <label className="flex items-center gap-2 text-sm text-[#666] hover:text-[#1A1A1A] cursor-pointer transition-colors duration-200">
                <RefreshCw size={16} />
                Importar
                <input type="file" accept=".txt" onChange={handleImport} className="hidden" />
              </label>
            </div>

            <div className="flex items-center gap-2 opacity-30">
              <span className="text-xs font-semibold text-[#999] tracking-wider uppercase">sPany</span>
              <img src="/icon-192.png" alt="logo" className="w-5 h-5 rounded-[4px] grayscale" />
            </div>
          </div>
        </div>

        {/* MODAL DE CONFIRMACIÓN PERSONALIZADO */}
        {entryToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-all duration-200">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm border border-[rgba(26,26,26,0.06)] shadow-[0_8px_30px_rgb(0,0,0,0.12)] animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">Eliminar clau</h3>
              <p className="text-sm text-[#666] mb-6">
                Estàs segur que vols eliminar aquesta clau? Aquesta acció no es pot desfer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setEntryToDelete(null)}
                  className="flex-1 px-4 py-2.5 bg-[#F7F7F5] border border-[rgba(26,26,26,0.06)] rounded-lg text-[#1A1A1A] font-medium hover:bg-[#ebebe8] transition-all duration-200"
                >
                  Cancel·lar
                </button>
                <button
                  onClick={() => handleDeleteEntry(entryToDelete!)}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-all duration-200 shadow-sm"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-6 flex items-center gap-4 border-b border-[rgba(26,26,26,0.06)]">
        <button onClick={() => setScreen('list')} aria-label="Tornar" className="p-2 text-[#1A1A1A] hover:bg-[#F7F7F5] rounded-lg transition-all duration-200">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-semibold text-[#1A1A1A]">{editingEntry.id ? 'Editar clau' : 'Nova clau'}</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <label className="text-sm font-semibold text-[#1A1A1A] block mb-2">Servei</label>
          <input type="text" value={editingEntry.service} onChange={e => setEditingEntry(p => ({ ...p, service: e.target.value }))} placeholder="p.e. Correu" className="w-full px-4 py-3 bg-[#F7F7F5] border border-[rgba(26,26,26,0.06)] rounded-lg text-[#1A1A1A] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:ring-opacity-20 transition-all duration-200" />
        </div>
        <div>
          <label className="text-sm font-semibold text-[#1A1A1A] block mb-2">Usuari</label>
          <input type="text" value={editingEntry.username} onChange={e => setEditingEntry(p => ({ ...p, username: e.target.value }))} placeholder="p.e. user@example.com" className="w-full px-4 py-3 bg-[#F7F7F5] border border-[rgba(26,26,26,0.06)] rounded-lg text-[#1A1A1A] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:ring-opacity-20 transition-all duration-200" />
        </div>
        <div>
          <label className="text-sm font-semibold text-[#1A1A1A] block mb-2">Contrasenya</label>
          <div className="flex gap-2">
            <input type={showPassword ? 'text' : 'password'} value={editingEntry.password} onChange={e => setEditingEntry(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" className="flex-1 px-4 py-3 bg-[#F7F7F5] border border-[rgba(26,26,26,0.06)] rounded-lg text-[#1A1A1A] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:ring-opacity-20 transition-all duration-200" />
            <button onClick={handleGeneratePassword} className="px-4 py-3 bg-[#F7F7F5] border border-[rgba(26,26,26,0.06)] rounded-lg text-[#1A1A1A] font-medium hover:bg-[#f0f0ed] transition-all duration-200 flex items-center gap-2">
              <RefreshCw size={18} />
              <span className="hidden sm:inline">Generar</span>
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-[#1A1A1A] block mb-2">Notes (opcional)</label>
          <textarea value={editingEntry.notes} onChange={e => setEditingEntry(p => ({ ...p, notes: e.target.value }))} placeholder="Afegeix totes les notes que creguis convenients..." rows={4} className="w-full px-4 py-3 bg-[#F7F7F5] border border-[rgba(26,26,26,0.06)] rounded-lg text-[#1A1A1A] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:ring-opacity-20 transition-all duration-200 resize-none" />
        </div>
        <button onClick={handleSaveEntry} className="w-full bg-[#1A1A1A] text-white font-semibold py-3 rounded-lg hover:bg-[#333] transition-all duration-200 shadow-sm mt-8">
          Guardar
        </button>
      </div>
      {notification && (
  <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg border animate-in fade-in slide-in-from-top-4 duration-300 ${
    notification.type === 'success' 
      ? 'bg-white text-[#1A1A1A] border-[rgba(26,26,26,0.08)]' 
      : 'bg-red-50 text-red-600 border-red-100'
  }`}>
    <p className="text-sm font-medium tracking-tight flex items-center gap-2">
      {notification.type === 'success' ? '✓' : '✕'} {notification.message}
    </p>
  </div>
)}
    </div>
  )
}