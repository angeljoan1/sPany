'use client';

import React, { useState, useCallback } from 'react';
import {
  Eye,
  EyeOff,
  Copy,
  Edit2,
  Trash2,
  ArrowLeft,
  Plus,
  Search,
  Download,
  RefreshCw,
  Delete,
} from 'lucide-react';

interface Entry {
  id: string;
  service: string;
  username: string;
  password: string;
  notes: string;
}

interface EditingEntry {
  id: string | null;
  service: string;
  username: string;
  password: string;
  notes: string;
}

export default function PasswordManager() {
  const [screen, setScreen] = useState<'login' | 'list' | 'edit'>('login');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<EditingEntry>({
    id: null,
    service: '',
    username: '',
    password: '',
    notes: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([
    {
      id: '1',
      service: 'Correu',
      username: 'user@example.com',
      password: 'SecurePass123!',
      notes: 'Compte principal de correu',
    },
    {
      id: '2',
      service: 'Banc en línia',
      username: 'john.doe',
      password: 'BankPass456@',
      notes: 'Accés al compte corrente',
    },
    {
      id: '3',
      service: 'Xarxes socials',
      username: 'johndoe',
      password: 'SocialMedia789#',
      notes: 'Compte personal',
    },
  ]);

  const correctPin = '123456';

  const handlePinInput = useCallback(
    (value: string) => {
      if (value.length <= 6) {
        setPin(value);
        setPinError(false);
      }
    },
    []
  );

  const handleUnlock = useCallback(() => {
    if (pin === correctPin) {
      setScreen('list');
      setPin('');
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 500);
    }
  }, [pin]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const filteredEntries = entries.filter((entry) =>
    entry.service.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewEntry = useCallback(() => {
    setEditingEntry({
      id: null,
      service: '',
      username: '',
      password: '',
      notes: '',
    });
    setShowPassword(false);
    setScreen('edit');
  }, []);

  const handleEditEntry = useCallback((entry: Entry) => {
    setEditingEntry({
      id: entry.id,
      service: entry.service,
      username: entry.username,
      password: entry.password,
      notes: entry.notes,
    });
    setShowPassword(false);
    setScreen('edit');
  }, []);

  const handleDeleteEntry = useCallback((id: string) => {
    if (confirm('Segur que vols eliminar aquesta clau?')) {
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      setExpandedId(null);
    }
  }, []);

  const handleGeneratePassword = useCallback(() => {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEditingEntry((prev) => ({ ...prev, password }));
  }, []);

  const handleSaveEntry = useCallback(() => {
    if (!editingEntry.service || !editingEntry.username || !editingEntry.password) {
      console.log('Please fill in all required fields');
      return;
    }

    if (editingEntry.id) {
      // Edit existing
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === editingEntry.id
            ? {
              ...entry,
              service: editingEntry.service,
              username: editingEntry.username,
              password: editingEntry.password,
              notes: editingEntry.notes,
            }
            : entry
        )
      );
    } else {
      // Create new
      const newEntry: Entry = {
        id: Date.now().toString(),
        service: editingEntry.service,
        username: editingEntry.username,
        password: editingEntry.password,
        notes: editingEntry.notes,
      };
      setEntries((prev) => [newEntry, ...prev]);
    }

    setScreen('list');
  }, [editingEntry]);

  const handleCopyPassword = useCallback((password: string, id: string) => {
    navigator.clipboard.writeText(password);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    console.log('Password copied to clipboard');
  }, []);

  const handleExport = useCallback(() => {
    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'claus-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    console.log('Backup exported');
  }, [entries]);

  // Screen 1: Login
  if (screen === 'login') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div
          className={`w-full max-w-sm bg-[#F7F7F5] rounded-2xl p-8 border border-[rgba(26,26,26,0.06)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.06)] transition-all duration-200 ${pinError ? 'animate-shake' : ''
            }`}
        >
          <h1 className="text-3xl font-semibold text-[#1A1A1A] text-center mb-12">
            Claus
          </h1>

          <div className="flex justify-center gap-3 mb-12">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-14 h-14 bg-white rounded-full border border-[rgba(26,26,26,0.08)] flex items-center justify-center text-2xl font-semibold text-[#1A1A1A]"
              >
                {pin[i] ? '●' : '○'}
              </div>
            ))}
          </div>

          <input
            type="number"
            value={pin}
            onChange={(e) => handlePinInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleUnlock()}
            className="sr-only"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoFocus
          />

          <div className="grid grid-cols-3 gap-3 mb-8">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => {
                  const newPin = pin + num;
                  if (newPin.length <= 6) {
                    setPin(newPin);
                    setPinError(false);
                  }
                }}
                className="aspect-square bg-neutral-100 rounded-lg border border-[rgba(26,26,26,0.06)] text-lg font-semibold text-[#1A1A1A] hover:bg-neutral-200 transition-all duration-200 shadow-sm"
              >
                {num}
              </button>
            ))}
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={() => {
                const newPin = pin + '0';
                if (newPin.length <= 6) {
                  setPin(newPin);
                  setPinError(false);
                }
              }}
              className="flex-1 aspect-square bg-neutral-100 rounded-lg border border-[rgba(26,26,26,0.06)] text-lg font-semibold text-[#1A1A1A] hover:bg-neutral-200 transition-all duration-200 shadow-sm"
            >
              0
            </button>
            <button
              onClick={() => setPin(pin.slice(0, -1))}
              className="aspect-square bg-gray-100 rounded-lg border border-[rgba(26,26,26,0.06)] text-gray-400 hover:bg-gray-150 transition-all duration-200 shadow-sm flex items-center justify-center"
            >
              <Delete size={20} />
            </button>
          </div>

          <button
            onClick={handleUnlock}
            className="w-full bg-[#1A1A1A] text-white font-semibold py-3 rounded-lg hover:bg-[#333] transition-all duration-200 shadow-sm"
          >
            Obrir
          </button>
        </div>

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
            20%, 40%, 60%, 80% { transform: translateX(8px); }
          }
          .animate-shake {
            animation: shake 0.5s;
          }
        `}</style>
      </div>
    );
  }

  // Screen 2: Entries List
  if (screen === 'list') {
    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 bg-white border-b border-[rgba(26,26,26,0.06)] z-20">
          <div className="max-w-2xl mx-auto px-4 py-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-[#1A1A1A]">Claus</h1>
            <button
              onClick={handleNewEntry}
              title="Nova clau"
              className="p-2 text-[#1A1A1A] hover:bg-[#F7F7F5] rounded-lg transition-all duration-200"
            >
              <Plus size={24} />
            </button>
          </div>

          <div className="max-w-2xl mx-auto px-4 pb-6">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]"
              />
              <input
                type="text"
                placeholder="Cerca un servei..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#F7F7F5] border border-[rgba(26,26,26,0.06)] rounded-lg text-[#1A1A1A] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:ring-opacity-20 transition-all duration-200"
              />
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-[#F7F7F5] rounded-2xl border border-[rgba(26,26,26,0.06)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.06)] overflow-hidden hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.08)] transition-all duration-200"
            >
              <button
                onClick={() =>
                  setExpandedId(expandedId === entry.id ? null : entry.id)
                }
                className="w-full p-4 text-left flex items-start justify-between hover:bg-[#f0f0ed] transition-colors duration-200"
              >
                <div className="flex-1">
                  <div className="text-base font-semibold text-[#1A1A1A]">
                    {entry.service}
                  </div>
                  <div className="text-sm text-[#666] mt-1">{entry.username}</div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditEntry(entry);
                    }}
                    className="p-2 text-[#666] hover:text-[#1A1A1A] transition-colors duration-200"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEntry(entry.id);
                    }}
                    className="p-2 text-[#666] hover:text-red-600 transition-colors duration-200"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </button>

              {expandedId === entry.id && (
                <div className="border-t border-[rgba(26,26,26,0.06)] px-4 py-4 bg-white space-y-4 animate-in fade-in duration-200">
                  <div>
                    <label className="text-xs font-semibold text-[#999] uppercase tracking-wide">
                      Usuari
                    </label>
                    <div className="text-sm text-[#1A1A1A] mt-1 font-mono break-all">
                      {entry.username}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#999] uppercase tracking-wide">
                      Contrasenya
                    </label>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="text-sm text-[#1A1A1A] font-mono flex-1 break-all">
                        {showPassword ? entry.password : '●'.repeat(entry.password.length)}
                      </div>
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Amaga' : 'Mostra'}
                        className="p-1 text-[#666] hover:text-[#1A1A1A] transition-colors duration-200"
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopyPassword(entry.password, entry.id)}
                        className="p-1 text-[#666] hover:text-[#1A1A1A] transition-colors duration-200"
                      >
                        {copiedId === entry.id ? (
                          <span className="text-xs font-semibold text-green-600">
                            Copiat!
                          </span>
                        ) : (
                          <Copy size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  {entry.notes && (
                    <div>
                      <label className="text-xs font-semibold text-[#999] uppercase tracking-wide">
                        Notes
                      </label>
                      <div className="text-sm text-[#666] mt-1">{entry.notes}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {filteredEntries.length === 0 && (
            <div className="text-center py-12">
              <div className="text-[#999] text-sm">
                No hi ha resultats per a la teva cerca.
              </div>
            </div>
          )}
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 border-t border-[rgba(26,26,26,0.06)]">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 text-sm text-[#666] hover:text-[#1A1A1A] transition-colors duration-200"
          >
            <Download size={16} />
            Exportar còpia
          </button>
        </div>
      </div>
    );
  }

  // Screen 3: New / Edit Entry
  if (screen === 'edit') {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-6 flex items-center gap-4 border-b border-[rgba(26,26,26,0.06)]">
          <button
            onClick={() => setScreen('list')}
            aria-label="Tornar"
            className="p-2 text-[#1A1A1A] hover:bg-[#F7F7F5] rounded-lg transition-all duration-200"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">
            {editingEntry.id ? 'Editar clau' : 'Nova clau'}
          </h1>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          {/* Service */}
          <div>
            <label className="text-sm font-semibold text-[#1A1A1A] block mb-2">
              Servei
            </label>
            <input
              type="text"
              value={editingEntry.service}
              onChange={(e) =>
                setEditingEntry((prev) => ({
                  ...prev,
                  service: e.target.value,
                }))
              }
              placeholder="p.e. Correu"
              className="w-full px-4 py-3 bg-[#F7F7F5] border border-[rgba(26,26,26,0.06)] rounded-lg text-[#1A1A1A] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:ring-opacity-20 transition-all duration-200"
            />
          </div>

          {/* Username */}
          <div>
            <label className="text-sm font-semibold text-[#1A1A1A] block mb-2">
              Usuari
            </label>
            <input
              type="text"
              value={editingEntry.username}
              onChange={(e) =>
                setEditingEntry((prev) => ({
                  ...prev,
                  username: e.target.value,
                }))
              }
              placeholder="p.e. user@example.com"
              className="w-full px-4 py-3 bg-[#F7F7F5] border border-[rgba(26,26,26,0.06)] rounded-lg text-[#1A1A1A] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:ring-opacity-20 transition-all duration-200"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-semibold text-[#1A1A1A] block mb-2">
              Contrasenya
            </label>
            <div className="flex gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={editingEntry.password}
                onChange={(e) =>
                  setEditingEntry((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                placeholder="••••••••"
                className="flex-1 px-4 py-3 bg-[#F7F7F5] border border-[rgba(26,26,26,0.06)] rounded-lg text-[#1A1A1A] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:ring-opacity-20 transition-all duration-200"
              />
              <button
                onClick={handleGeneratePassword}
                className="px-4 py-3 bg-[#F7F7F5] border border-[rgba(26,26,26,0.06)] rounded-lg text-[#1A1A1A] font-medium hover:bg-[#f0f0ed] transition-all duration-200 flex items-center gap-2"
              >
                <RefreshCw size={18} />
                <span className="hidden sm:inline">Generar</span>
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-semibold text-[#1A1A1A] block mb-2">
              Notes (opcional)
            </label>
            <textarea
              value={editingEntry.notes}
              onChange={(e) =>
                setEditingEntry((prev) => ({
                  ...prev,
                  notes: e.target.value,
                }))
              }
              placeholder="Afegeix totes les notes que creguis convenients..."
              rows={4}
              className="w-full px-4 py-3 bg-[#F7F7F5] border border-[rgba(26,26,26,0.06)] rounded-lg text-[#1A1A1A] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:ring-opacity-20 transition-all duration-200 resize-none"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveEntry}
            className="w-full bg-[#1A1A1A] text-white font-semibold py-3 rounded-lg hover:bg-[#333] transition-all duration-200 shadow-sm mt-8"
          >
            Guardar
          </button>
        </div>
      </div>
    );
  }
}
