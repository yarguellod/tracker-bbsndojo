import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { toKey } from '../lib/date'

const todayKey = () => toKey(new Date())
const monthOf = (d) => d.slice(0, 7)
const fmtMoney = (n) => `$${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 === 0 ? 0 : 2 })}`
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtInvoiceDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })

const TYPES = [
  { id: 'show',          label: 'Show',          bg: 'bg-emerald-500', text: 'text-emerald-200', dot: 'bg-emerald-500', placeholder: 'Band or venue (optional)' },
  { id: 'rehearsal',     label: 'Rehearsal',     bg: 'bg-blue-500',    text: 'text-blue-200',    dot: 'bg-blue-500',    placeholder: 'Band (optional)' },
  { id: 'sound',         label: 'Sound',         bg: 'bg-cyan-500',    text: 'text-cyan-200',    dot: 'bg-cyan-500',    placeholder: 'Venue (optional)' },
  { id: 'lesson',        label: 'Lesson',        bg: 'bg-purple-500',  text: 'text-purple-200',  dot: 'bg-purple-500',  placeholder: 'Student (optional)' },
  { id: 'mixing',        label: 'Mixing',        bg: 'bg-pink-500',    text: 'text-pink-200',    dot: 'bg-pink-500',    placeholder: 'Project or artist (optional)' },
  { id: 'repair',        label: 'Repair',        bg: 'bg-orange-500',  text: 'text-orange-200',  dot: 'bg-orange-500',  placeholder: 'What was fixed? (optional)' },
  { id: 'reimbursement', label: 'Reimbursement', bg: 'bg-amber-500',   text: 'text-amber-200',   dot: 'bg-amber-500',   placeholder: 'Reimbursable item (optional)' },
]
const typeOf = (id) => TYPES.find(t => t.id === id) || TYPES[0]
const isHourlyType = (id) => ['rehearsal', 'lesson', 'mixing'].includes(id)

const DEFAULT_TYPE_PRESETS = {
  show: [
    { id: 'sounddogs', name: 'Sound Dogs' },
    { id: 'ruby',      name: 'Ruby' },
    { id: 'ardra',     name: 'Ardra' },
    { id: 'mangordan', name: 'Man Gordan' },
    { id: 'motley',    name: 'Motley' },
    { id: 'emi',       name: 'Emi' },
  ],
  sound: [
    { id: 'ethyls',   name: "Ethyl's" },
    { id: 'cityview', name: 'City View' },
  ],
  rehearsal: [
    { id: 'sounddogs', name: 'Sound Dogs' },
    { id: 'ardra',     name: 'Ardra' },
    { id: 'mangordan', name: 'Man Gordan' },
    { id: 'motley',    name: 'Motley' },
  ],
  lesson: [
    { id: 'kids', name: 'Kids', rate: 300 },
    { id: 'jess', name: 'Jess', rate: 50 },
    { id: 'lisa', name: 'Lisa' },
  ],
  mixing: [],
  repair: [
    { id: 'boat', name: 'Boat' },
    { id: 'bike', name: 'Bike' },
    { id: 'car',  name: 'Car' },
  ],
  reimbursement: [],
}

const emptyForm = (typeId = 'show') => ({
  type: typeId, date: todayKey(), amount: '', hours: '', rate: '', paid: false, notes: '',
})

function EntryModal({ user, presets, onSavePresets, editing, onClose }) {
  const [form, setForm] = useState(() => {
    if (!editing) return emptyForm()
    return {
      type: editing.type,
      date: editing.date,
      amount: String(editing.amount ?? ''),
      hours: String(editing.hours ?? ''),
      rate: String(editing.rate || (editing.type === 'mixing' ? 300 : '')),
      paid: !!editing.paid,
      notes: editing.notes ?? '',
    }
  })
  const [showAddPreset, setShowAddPreset] = useState(false)
  const [newPreset, setNewPreset] = useState({ name: '', value: '' })

  const t = typeOf(form.type)
  const isHourly = isHourlyType(form.type)
  const typePresets = presets[form.type] || []

  useEffect(() => {
    if (!isHourly) return
    const h = Number(form.hours), r = Number(form.rate)
    if (h > 0 && r > 0) {
      const calc = Math.round(h * r * 100) / 100
      setForm(f => ({ ...f, amount: String(calc) }))
    }
  }, [form.hours, form.rate, isHourly])

  const pickPreset = (p) => {
    setForm(f => {
      const next = { ...f, notes: f.notes || p.name }
      if (isHourly && p.rate) {
        next.rate = String(p.rate)
        if (!f.hours) next.hours = '1'
      } else if (!isHourly && p.amount) {
        next.amount = String(p.amount)
      }
      return next
    })
  }

  const addPreset = async () => {
    if (!newPreset.name.trim()) return
    const v = Number(newPreset.value)
    const entry = { id: crypto.randomUUID().slice(0, 8), name: newPreset.name.trim() }
    if (v > 0) entry[isHourly ? 'rate' : 'amount'] = v
    await onSavePresets(form.type, [...typePresets, entry])
    setNewPreset({ name: '', value: '' })
    setShowAddPreset(false)
  }

  const deletePreset = async (id) => {
    await onSavePresets(form.type, typePresets.filter(p => p.id !== id))
  }

  const save = async () => {
    const amt = Number(form.amount)
    if (!amt || amt <= 0) return
    const data = {
      type: form.type,
      date: form.date,
      amount: amt,
      paid: form.paid,
      notes: form.notes.trim(),
      hours: isHourly ? Number(form.hours) || 0 : 0,
      rate: isHourly ? Number(form.rate) || 0 : 0,
    }
    if (editing) {
      await updateDoc(doc(db, 'users', user.uid, 'money', editing.id), data)
    } else {
      await addDoc(collection(db, 'users', user.uid, 'money'), { ...data, createdAt: Date.now() })
    }
    onClose()
  }

  const remove = async () => {
    if (!editing) return
    await deleteDoc(doc(db, 'users', user.uid, 'money', editing.id))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div className="bg-zinc-900 rounded-t-3xl p-3.5 max-h-[90dvh] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] flex flex-col gap-2.5 overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-1" />
        <p className="text-white font-semibold text-sm">{editing ? 'Edit entry' : 'New entry'}</p>

        <div className="grid grid-cols-3 gap-1">
          {TYPES.map(tt => (
            <button key={tt.id} onClick={() => setForm(f => ({ ...f, type: tt.id, hours: '', rate: tt.id === 'mixing' ? '300' : '' }))}
              className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${form.type === tt.id ? `${tt.bg} text-white` : 'bg-zinc-800 text-zinc-400'}`}>
              {tt.label}
            </button>
          ))}
        </div>

        {typePresets.length > 0 || true ? (
          <div className="space-y-1.5">
            <div className="flex gap-1 flex-wrap">
              {typePresets.map(p => {
                const v = isHourly ? p.rate : p.amount
                const active = isHourly ? Number(form.rate) === p.rate : false
                return (
                  <div key={p.id} className={`flex items-center rounded-full overflow-hidden ${active ? 'bg-zinc-700' : 'bg-zinc-800'}`}>
                    <button onClick={() => pickPreset(p)} className="px-2 py-0.5 text-xs font-medium text-zinc-200">
                      {p.name}{v ? <span className="text-zinc-500"> ${v}{isHourly ? '/hr' : ''}</span> : ''}
                    </button>
                    <button onClick={() => deletePreset(p.id)} className="px-1.5 py-0.5 text-zinc-600 active:text-red-400 text-xs">×</button>
                  </div>
                )
              })}
              {!showAddPreset && (
                <button onClick={() => setShowAddPreset(true)} className="bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full text-xs">+</button>
              )}
            </div>
            {showAddPreset && (
              <div className="flex gap-1 items-center bg-zinc-800 rounded-lg p-1">
                <input placeholder="Name" value={newPreset.name} onChange={e => setNewPreset(p => ({ ...p, name: e.target.value }))}
                  className="flex-1 bg-zinc-900 text-white rounded px-2 py-1 text-xs outline-none" autoFocus />
                <span className="text-zinc-500 text-xs">$</span>
                <input type="number" inputMode="decimal" placeholder={isHourly ? '/hr' : 'amt'} value={newPreset.value}
                  onChange={e => setNewPreset(p => ({ ...p, value: e.target.value }))}
                  className="w-14 bg-zinc-900 text-white rounded px-1.5 py-1 text-xs outline-none" />
                <button onClick={addPreset} className={`${t.bg} text-white text-xs font-semibold px-2 py-1 rounded`}>Save</button>
                <button onClick={() => setShowAddPreset(false)} className="text-zinc-500 text-xs px-1">×</button>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="flex-1 bg-zinc-800 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-green-500" />
          <div className="flex-1 flex items-center bg-zinc-800 rounded-lg px-2.5">
            <span className="text-zinc-500 text-xs">$</span>
            <input type="number" inputMode="decimal" placeholder="Amount" value={form.amount} autoFocus={!editing}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value, hours: '', rate: '' }))}
              className="flex-1 bg-transparent text-white py-1.5 px-1.5 text-xs outline-none min-w-0" />
          </div>
        </div>

        {isHourly && (
          <div className="bg-zinc-800/40 border border-zinc-800 rounded-lg p-2 flex items-center gap-1.5">
            <input type="number" inputMode="decimal" placeholder="Hrs" value={form.hours}
              onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
              className="flex-1 bg-zinc-800 text-white rounded px-2 py-1 text-xs outline-none" />
            <span className="text-zinc-600 text-xs">×</span>
            <div className="flex-1 flex items-center bg-zinc-800 rounded px-1.5">
              <span className="text-zinc-500 text-xs">$</span>
              <input type="number" inputMode="decimal" placeholder="rate" value={form.rate}
                onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
                className="flex-1 bg-transparent text-white py-1 px-1 text-xs outline-none min-w-0" />
              <span className="text-zinc-500 text-[10px]">/hr</span>
            </div>
            {Number(form.hours) > 0 && Number(form.rate) > 0 && (
              <span className="text-green-400 text-xs font-bold whitespace-nowrap">= {fmtMoney(Number(form.hours) * Number(form.rate))}</span>
            )}
          </div>
        )}

        <input type="text" placeholder={t.placeholder}
          value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="w-full bg-zinc-800 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-green-500" />

        <button onClick={() => setForm(f => ({ ...f, paid: !f.paid }))}
          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-all ${form.paid ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
          <span className="font-semibold">{form.paid ? 'Paid' : 'Unpaid'}</span>
          <span className="text-[10px] opacity-70">tap to toggle</span>
        </button>

        <div className="flex gap-1.5">
          {editing && (
            <button onClick={remove} className="px-3 py-2 bg-red-500/15 text-red-400 rounded-lg text-xs font-semibold">Delete</button>
          )}
          <button onClick={onClose} className="flex-1 bg-zinc-800 text-white py-2 rounded-lg text-xs font-semibold">Cancel</button>
          <button onClick={save} disabled={!form.amount || Number(form.amount) <= 0}
            className="flex-1 bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold py-2 rounded-lg text-xs">
            {editing ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

const INVOICE_GROUP_LABELS = {
  show: 'Shows',
  rehearsal: 'Rehearsals',
  sound: 'Sound',
  lesson: 'Lessons',
  mixing: 'Mixing',
  repair: 'Repairs',
  reimbursement: 'Reimbursements',
}

const makeInvoiceText = (title, entries) => {
  const lines = [title.trim() || 'Invoice', '']
  for (const type of TYPES) {
    const group = entries.filter(e => e.type === type.id).sort((a, b) => a.date.localeCompare(b.date))
    if (!group.length) continue
    lines.push(`${INVOICE_GROUP_LABELS[type.id]}:`)
    for (const entry of group) {
      const details = [fmtInvoiceDate(entry.date)]
      if (Number(entry.hours) > 0 && Number(entry.rate) > 0) {
        details.push(`${entry.hours} ${Number(entry.hours) === 1 ? 'hr' : 'hrs'} @ ${fmtMoney(Number(entry.rate))}/hr`)
      }
      if (entry.notes) details.push(entry.notes)
      lines.push(`${details.join(' — ')} — ${fmtMoney(Number(entry.amount) || 0)}`)
    }
    const total = group.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
    lines.push(`Total = ${fmtMoney(total)}`, '')
  }
  const total = entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
  lines.push(`TOTAL = ${fmtMoney(total)}`)
  return lines.join('\n')
}

export default function Money() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [presets, setPresets] = useState(DEFAULT_TYPE_PRESETS)
  const [invoiceMode, setInvoiceMode] = useState(false)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([])
  const [showInvoice, setShowInvoice] = useState(false)
  const [invoiceTitle, setInvoiceTitle] = useState('Invoice')

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'users', user.uid, 'money'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [user])

  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'users', user.uid, 'settings', 'typePresets')).then(snap => {
      if (!snap.exists() || !snap.data()) return
      const saved = snap.data()
      const updated = { ...DEFAULT_TYPE_PRESETS, ...saved }
      for (const typeId of ['show', 'rehearsal']) {
        const defaults = DEFAULT_TYPE_PRESETS[typeId]
        let list = (saved[typeId] || defaults)
          .filter(p => !['thenude', 'kalea'].includes(p.id) && !['the nude', 'kalea'].includes((p.name || '').toLowerCase()))
          .map(p => p.id === 'rubybluesday' ? { ...p, id: 'ruby', name: 'Ruby' } : p)
        for (const preset of defaults.slice(0, typeId === 'show' ? 5 : 3)) {
          if (!list.some(p => p.id === preset.id)) list.push(preset)
        }
        list.sort((a, b) => {
          const aIndex = defaults.findIndex(p => p.id === a.id)
          const bIndex = defaults.findIndex(p => p.id === b.id)
          return (aIndex < 0 ? defaults.length : aIndex) - (bIndex < 0 ? defaults.length : bIndex)
        })
        updated[typeId] = list
      }
      setPresets(updated)
    })
  }, [user])

  const savePresets = async (typeId, list) => {
    const updated = { ...presets, [typeId]: list }
    setPresets(updated)
    await setDoc(doc(db, 'users', user.uid, 'settings', 'typePresets'), updated, { merge: true })
  }

  const incomeEntries = entries.filter(e => e.type !== 'expense')
  const thisMonth = todayKey().slice(0, 7)
  const monthEntries = incomeEntries.filter(e => monthOf(e.date) === thisMonth)
  const income = monthEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const unpaid = monthEntries.filter(e => !e.paid).reduce((s, e) => s + (Number(e.amount) || 0), 0)

  const byType = TYPES.map(t => ({
    ...t,
    total: monthEntries.filter(e => e.type === t.id).reduce((s, e) => s + (Number(e.amount) || 0), 0),
  })).filter(t => t.total > 0)

  const filtered = filter === 'all'
    ? incomeEntries
    : filter === 'unpaid'
      ? incomeEntries.filter(e => !e.paid)
      : incomeEntries.filter(e => e.type === filter)
  const selectedInvoiceEntries = incomeEntries.filter(e => selectedInvoiceIds.includes(e.id))
  const invoiceText = makeInvoiceText(invoiceTitle, selectedInvoiceEntries)

  const togglePaid = async (e, evt) => {
    evt.stopPropagation()
    await updateDoc(doc(db, 'users', user.uid, 'money', e.id), { paid: !e.paid })
  }

  const toggleInvoiceSelection = (entry) => {
    setSelectedInvoiceIds(ids => ids.includes(entry.id) ? ids.filter(id => id !== entry.id) : [...ids, entry.id])
  }
  const startInvoice = () => {
    setFilter('all')
    setSelectedInvoiceIds([])
    setInvoiceTitle('Invoice')
    setInvoiceMode(true)
  }
  const cancelInvoice = () => {
    setInvoiceMode(false)
    setSelectedInvoiceIds([])
  }
  const openInvoice = () => {
    if (!selectedInvoiceIds.length) return
    setShowInvoice(true)
  }

  const openNew = () => { setEditing(null); setShowModal(true) }
  const openEdit = (entry) => { setEditing(entry); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditing(null) }

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-full bg-zinc-950 pb-24">
      <div className="sticky top-0 z-10 bg-zinc-950 px-4 pt-3 pb-2 border-b border-zinc-900 flex items-center justify-between">
        <h1 className="text-white font-bold text-base">Money</h1>
        {invoiceMode ? (
          <button onClick={cancelInvoice} className="text-zinc-400 text-xs font-semibold">Cancel invoice</button>
        ) : (
          <button onClick={startInvoice} className="bg-zinc-800 text-zinc-200 px-3 py-1.5 rounded-lg text-xs font-semibold">Create invoice</button>
        )}
      </div>

      <div className="px-3 pt-3 space-y-3">
        <div className="bg-zinc-900 rounded-2xl p-3">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">{monthLabel} income</p>
          <div className="flex items-baseline justify-between gap-1.5 mb-2">
            <span className="text-2xl font-bold text-emerald-400">{fmtMoney(income)}</span>
            <span className="text-amber-400 text-xs">{fmtMoney(unpaid)} unpaid</span>
          </div>
          {byType.length > 0 && (
            <div className="flex gap-1 flex-wrap pt-2 border-t border-zinc-800">
              {byType.map(t => (
                <div key={t.id} className="flex items-center gap-1 bg-zinc-800 rounded-full px-2 py-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                  <span className="text-zinc-300 text-[10px]">{t.label}</span>
                  <span className="text-zinc-500 text-[10px]">{fmtMoney(t.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {invoiceMode && (
          <div className="bg-green-500/10 text-green-300 rounded-lg px-3 py-2 text-xs">
            Tap income items to add them to the invoice. Selected: {selectedInvoiceIds.length}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto -mx-3 px-3 pb-1" style={{ scrollbarWidth: 'none' }}>
          {[['all', 'All'], ['unpaid', 'Unpaid'], ...TYPES.map(t => [t.id, INVOICE_GROUP_LABELS[t.id]])].map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${filter === id ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          {filtered.length === 0 && (
            <p className="text-zinc-600 text-xs text-center py-10">
              {incomeEntries.length === 0 ? 'Tap + to add your first income entry' : 'Nothing here for this filter'}
            </p>
          )}
          {filtered.map(e => {
            const t = typeOf(e.type)
            const selected = selectedInvoiceIds.includes(e.id)
            return (
              <button key={e.id} onClick={() => invoiceMode ? toggleInvoiceSelection(e) : openEdit(e)}
                className={`w-full text-left rounded-xl px-3 py-2 flex items-center gap-2.5 active:bg-zinc-800 transition-colors ${selected ? 'bg-green-950 ring-1 ring-green-500' : 'bg-zinc-900'}`}>
                {invoiceMode ? (
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${selected ? 'bg-green-500 border-green-500 text-black' : 'border-zinc-600 text-transparent'}`}>✓</span>
                ) : (
                  <div className={`w-1 self-stretch ${t.dot} rounded-full flex-shrink-0`} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white text-xs font-semibold">{t.label}</span>
                    {!e.paid && (
                      <span onClick={(evt) => togglePaid(e, evt)} className="bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider px-1 py-px rounded cursor-pointer">
                        Unpaid
                      </span>
                    )}
                    {e.paid && (
                      <span onClick={(evt) => togglePaid(e, evt)} className="text-zinc-600 text-[9px] uppercase tracking-wider cursor-pointer">
                        Paid
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-500 text-[10px] flex flex-wrap gap-x-1.5">
                    <span>{fmtDate(e.date)}</span>
                    {e.notes && <span className="text-zinc-400 truncate">· {e.notes}</span>}
                  </p>
                </div>
                <span className="font-bold text-sm text-emerald-400">{fmtMoney(e.amount)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {invoiceMode && (
        <button onClick={openInvoice} disabled={!selectedInvoiceIds.length}
          className="fixed left-4 right-20 bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold py-3 rounded-xl shadow-lg z-40 text-sm"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}>
          Review invoice ({selectedInvoiceIds.length})
        </button>
      )}

      {!invoiceMode && (
        <button onClick={openNew}
          className="fixed right-4 w-14 h-14 bg-green-500 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center active:scale-95 transition-transform z-40"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-black"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
      )}

      {showModal && <EntryModal user={user} presets={presets} onSavePresets={savePresets} editing={editing} onClose={closeModal} />}

      {showInvoice && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setShowInvoice(false)}>
          <div className="bg-zinc-900 rounded-t-3xl p-4 max-h-[90dvh] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] flex flex-col gap-3"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto" />
            <div>
              <p className="text-white font-semibold text-sm">Invoice preview</p>
              <p className="text-zinc-500 text-xs">Check the items, then open your text app to choose a recipient and send.</p>
            </div>
            <input value={invoiceTitle} onChange={e => setInvoiceTitle(e.target.value)} aria-label="Invoice title"
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-500" />
            <textarea readOnly value={invoiceText} rows={12}
              className="w-full resize-none bg-zinc-950 text-zinc-200 rounded-lg p-3 text-xs leading-relaxed outline-none" />
            <div className="flex gap-2">
              <button onClick={() => setShowInvoice(false)} className="flex-1 bg-zinc-800 text-white py-2.5 rounded-lg text-xs font-semibold">Back to entries</button>
              <a href={`sms:?body=${encodeURIComponent(invoiceText)}`} className="flex-1 text-center bg-green-500 text-black py-2.5 rounded-lg text-xs font-bold">Open text message</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
