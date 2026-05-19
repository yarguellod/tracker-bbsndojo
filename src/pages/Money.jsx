import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const todayKey = () => new Date().toISOString().slice(0, 10)
const monthOf = (d) => d.slice(0, 7)
const fmtMoney = (n) => `$${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 === 0 ? 0 : 2 })}`
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const TYPES = [
  { id: 'show',      label: 'Show',      bg: 'bg-emerald-500', text: 'text-emerald-200', dot: 'bg-emerald-500', placeholder: 'Band or venue (optional)' },
  { id: 'sound',     label: 'Sound',     bg: 'bg-cyan-500',    text: 'text-cyan-200',    dot: 'bg-cyan-500',    placeholder: 'Venue (optional)' },
  { id: 'rehearsal', label: 'Rehearsal', bg: 'bg-blue-500',    text: 'text-blue-200',    dot: 'bg-blue-500',    placeholder: 'Band (optional)' },
  { id: 'lesson',    label: 'Lesson',    bg: 'bg-purple-500',  text: 'text-purple-200',  dot: 'bg-purple-500',  placeholder: 'Student (optional)' },
  { id: 'repair',    label: 'Repair',    bg: 'bg-orange-500',  text: 'text-orange-200',  dot: 'bg-orange-500',  placeholder: "What was fixed? (optional)" },
  { id: 'expense',   label: 'Expense',   bg: 'bg-red-500',     text: 'text-red-200',     dot: 'bg-red-500',     placeholder: 'What for? (optional)' },
]
const typeOf = (id) => TYPES.find(t => t.id === id) || TYPES[0]

const DEFAULT_TYPE_PRESETS = {
  show: [
    { id: 'sounddogs',    name: 'Sound Dogs' },
    { id: 'rubybluesday', name: 'Ruby Bluesday' },
    { id: 'ardra',        name: 'Ardra' },
    { id: 'thenude',      name: 'The Nude' },
    { id: 'motley',       name: 'Motley' },
    { id: 'kalea',        name: 'Kalea' },
    { id: 'emi',          name: 'Emi' },
  ],
  sound: [
    { id: 'ethyls',   name: "Ethyl's" },
    { id: 'cityview', name: 'City View' },
  ],
  rehearsal: [
    { id: 'sounddogs', name: 'Sound Dogs' },
    { id: 'thenude',   name: 'The Nude' },
    { id: 'motley',    name: 'Motley' },
    { id: 'ardra',     name: 'Ardra' },
  ],
  lesson: [
    { id: 'kids', name: 'Kids', rate: 300 },
    { id: 'jess', name: 'Jess', rate: 50 },
    { id: 'lisa', name: 'Lisa' },
  ],
  repair: [
    { id: 'boat', name: 'Boat' },
    { id: 'bike', name: 'Bike' },
    { id: 'car',  name: 'Car' },
  ],
  expense: [
    { id: 'phone',     name: 'Phone bill' },
    { id: 'insurance', name: 'Insurance' },
    { id: 'rent',      name: 'Rent' },
    { id: 'store',     name: 'Store' },
    { id: 'gas',       name: 'Gas' },
  ],
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
      hours: '',
      rate: '',
      paid: !!editing.paid,
      notes: editing.notes ?? '',
    }
  })
  const [showAddPreset, setShowAddPreset] = useState(false)
  const [newPreset, setNewPreset] = useState({ name: '', value: '' })

  const t = typeOf(form.type)
  const isLesson = form.type === 'lesson'
  const isExpense = form.type === 'expense'
  const typePresets = presets[form.type] || []

  useEffect(() => {
    if (!isLesson) return
    const h = Number(form.hours), r = Number(form.rate)
    if (h > 0 && r > 0) {
      const calc = Math.round(h * r * 100) / 100
      setForm(f => ({ ...f, amount: String(calc) }))
    }
  }, [form.hours, form.rate, isLesson])

  const pickPreset = (p) => {
    setForm(f => {
      const next = { ...f, notes: f.notes || p.name }
      if (isLesson && p.rate) {
        next.rate = String(p.rate)
        if (!f.hours) next.hours = '1'
      } else if (!isLesson && p.amount) {
        next.amount = String(p.amount)
      }
      return next
    })
  }

  const addPreset = async () => {
    if (!newPreset.name.trim()) return
    const v = Number(newPreset.value)
    const entry = { id: crypto.randomUUID().slice(0, 8), name: newPreset.name.trim() }
    if (v > 0) entry[isLesson ? 'rate' : 'amount'] = v
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
    let notes = form.notes.trim()
    if (isLesson) {
      const h = Number(form.hours), r = Number(form.rate)
      if (h > 0 && r > 0 && !notes.match(/\d+\s*hr/i)) {
        notes = notes ? `${notes} — ${h}hr @ $${r}/hr` : `${h}hr @ $${r}/hr`
      }
    }
    const data = {
      type: form.type,
      date: form.date,
      amount: amt,
      paid: isExpense ? true : form.paid,
      notes,
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
            <button key={tt.id} onClick={() => setForm(f => ({ ...f, type: tt.id, hours: '', rate: '' }))}
              className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${form.type === tt.id ? `${tt.bg} text-white` : 'bg-zinc-800 text-zinc-400'}`}>
              {tt.label}
            </button>
          ))}
        </div>

        {typePresets.length > 0 || true ? (
          <div className="space-y-1.5">
            <div className="flex gap-1 flex-wrap">
              {typePresets.map(p => {
                const v = isLesson ? p.rate : p.amount
                const active = isLesson ? Number(form.rate) === p.rate : false
                return (
                  <div key={p.id} className={`flex items-center rounded-full overflow-hidden ${active ? 'bg-zinc-700' : 'bg-zinc-800'}`}>
                    <button onClick={() => pickPreset(p)} className="px-2 py-0.5 text-xs font-medium text-zinc-200">
                      {p.name}{v ? <span className="text-zinc-500"> ${v}{isLesson ? '/hr' : ''}</span> : ''}
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
                <input type="number" inputMode="decimal" placeholder={isLesson ? '/hr' : 'amt'} value={newPreset.value}
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

        {isLesson && (
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

        {!isExpense && (
          <button onClick={() => setForm(f => ({ ...f, paid: !f.paid }))}
            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-all ${form.paid ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
            <span className="font-semibold">{form.paid ? 'Paid' : 'Unpaid'}</span>
            <span className="text-[10px] opacity-70">tap to toggle</span>
          </button>
        )}

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

export default function Money() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [presets, setPresets] = useState(DEFAULT_TYPE_PRESETS)

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
      if (snap.exists() && snap.data()) {
        setPresets(p => ({ ...DEFAULT_TYPE_PRESETS, ...snap.data() }))
      }
    })
  }, [user])

  const savePresets = async (typeId, list) => {
    const updated = { ...presets, [typeId]: list }
    setPresets(updated)
    await setDoc(doc(db, 'users', user.uid, 'settings', 'typePresets'), updated, { merge: true })
  }

  const thisMonth = todayKey().slice(0, 7)
  const monthEntries = entries.filter(e => monthOf(e.date) === thisMonth)
  const income = monthEntries.filter(e => e.type !== 'expense').reduce((s, e) => s + e.amount, 0)
  const unpaid = monthEntries.filter(e => e.type !== 'expense' && !e.paid).reduce((s, e) => s + e.amount, 0)
  const expenses = monthEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const net = income - expenses

  const byType = TYPES.filter(t => t.id !== 'expense').map(t => ({
    ...t,
    total: monthEntries.filter(e => e.type === t.id).reduce((s, e) => s + e.amount, 0),
  })).filter(t => t.total > 0)

  const filtered = filter === 'all'
    ? entries
    : filter === 'unpaid'
      ? entries.filter(e => e.type !== 'expense' && !e.paid)
      : entries.filter(e => e.type === filter)

  const togglePaid = async (e, evt) => {
    evt.stopPropagation()
    await updateDoc(doc(db, 'users', user.uid, 'money', e.id), { paid: !e.paid })
  }

  const openNew = () => { setEditing(null); setShowModal(true) }
  const openEdit = (entry) => { setEditing(entry); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditing(null) }

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-full bg-zinc-950 pb-24">
      <div className="sticky top-0 z-10 bg-zinc-950 px-4 pt-3 pb-2 border-b border-zinc-900">
        <h1 className="text-white font-bold text-base">Money</h1>
      </div>

      <div className="px-3 pt-3 space-y-3">
        <div className="bg-zinc-900 rounded-2xl p-3">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">{monthLabel}</p>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className={`text-2xl font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMoney(net)}</span>
            <span className="text-zinc-500 text-xs">net</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
            <div className="bg-zinc-800 rounded-lg py-1.5">
              <p className="text-emerald-400 text-xs font-bold">{fmtMoney(income)}</p>
              <p className="text-zinc-600 text-[10px]">Income</p>
            </div>
            <div className="bg-zinc-800 rounded-lg py-1.5">
              <p className="text-amber-400 text-xs font-bold">{fmtMoney(unpaid)}</p>
              <p className="text-zinc-600 text-[10px]">Unpaid</p>
            </div>
            <div className="bg-zinc-800 rounded-lg py-1.5">
              <p className="text-red-400 text-xs font-bold">{fmtMoney(expenses)}</p>
              <p className="text-zinc-600 text-[10px]">Expenses</p>
            </div>
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

        <div className="flex gap-1 overflow-x-auto -mx-3 px-3 pb-1" style={{ scrollbarWidth: 'none' }}>
          {[['all', 'All'], ['unpaid', 'Unpaid'], ...TYPES.map(t => [t.id, t.label + 's'])].map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${filter === id ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          {filtered.length === 0 && (
            <p className="text-zinc-600 text-xs text-center py-10">
              {entries.length === 0 ? 'Tap + to add your first entry' : 'Nothing here for this filter'}
            </p>
          )}
          {filtered.map(e => {
            const t = typeOf(e.type)
            const isExpense = e.type === 'expense'
            return (
              <button key={e.id} onClick={() => openEdit(e)}
                className="w-full text-left bg-zinc-900 rounded-xl px-3 py-2 flex items-center gap-2.5 active:bg-zinc-800 transition-colors">
                <div className={`w-1 self-stretch ${t.dot} rounded-full flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white text-xs font-semibold">{t.label}</span>
                    {!isExpense && !e.paid && (
                      <span onClick={(evt) => togglePaid(e, evt)} className="bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider px-1 py-px rounded cursor-pointer">
                        Unpaid
                      </span>
                    )}
                    {!isExpense && e.paid && (
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
                <span className={`font-bold text-sm ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
                  {isExpense ? '−' : '+'}{fmtMoney(e.amount)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <button onClick={openNew}
        className="fixed right-4 w-14 h-14 bg-green-500 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center active:scale-95 transition-transform z-40"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-black"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>

      {showModal && <EntryModal user={user} presets={presets} onSavePresets={savePresets} editing={editing} onClose={closeModal} />}
    </div>
  )
}
