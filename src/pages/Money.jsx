import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const todayKey = () => new Date().toISOString().slice(0, 10)
const monthOf = (d) => d.slice(0, 7)
const fmtMoney = (n) => `$${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 === 0 ? 0 : 2 })}`
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const TYPES = [
  { id: 'gig',       label: 'Gig',       bg: 'bg-emerald-500', text: 'text-emerald-200', dot: 'bg-emerald-500', placeholder: 'Venue or band' },
  { id: 'sound',     label: 'Sound',     bg: 'bg-cyan-500',    text: 'text-cyan-200',    dot: 'bg-cyan-500',    placeholder: 'Event, band, venue' },
  { id: 'rehearsal', label: 'Rehearsal', bg: 'bg-blue-500',    text: 'text-blue-200',    dot: 'bg-blue-500',    placeholder: 'Band or project' },
  { id: 'lesson',    label: 'Lesson',    bg: 'bg-purple-500',  text: 'text-purple-200',  dot: 'bg-purple-500',  placeholder: 'Student or topic' },
  { id: 'repair',    label: 'Repair',    bg: 'bg-orange-500',  text: 'text-orange-200',  dot: 'bg-orange-500',  placeholder: "What was fixed? (Mike's bike, Sarah's car)" },
  { id: 'expense',   label: 'Expense',   bg: 'bg-red-500',     text: 'text-red-200',     dot: 'bg-red-500',     placeholder: 'What for? (gas, strings, fee)' },
]
const typeOf = (id) => TYPES.find(t => t.id === id) || TYPES[0]

const DEFAULT_PRESETS = [
  { id: 'kids', name: 'Kids', rate: 300 },
  { id: 'jess', name: 'Jess', rate: 50 },
]

const DEFAULT_EXPENSE_PRESETS = [
  { id: 'phone',     name: 'Phone bill' },
  { id: 'insurance', name: 'Insurance' },
  { id: 'rent',      name: 'Rent' },
  { id: 'store',     name: 'Store' },
  { id: 'gas',       name: 'Gas' },
]

function AddModal({ user, presets, expensePresets, onSavePresets, onSaveExpensePresets, onClose }) {
  const [form, setForm] = useState({
    type: 'gig', date: todayKey(), amount: '', hours: '', rate: '', paid: true, notes: '',
  })
  const [showAddPreset, setShowAddPreset] = useState(false)
  const [newPreset, setNewPreset] = useState({ name: '', rate: '' })
  const [showAddExpensePreset, setShowAddExpensePreset] = useState(false)
  const [newExpensePreset, setNewExpensePreset] = useState({ name: '', amount: '' })

  const isExpense = form.type === 'expense'
  const t = typeOf(form.type)

  useEffect(() => {
    const h = Number(form.hours), r = Number(form.rate)
    if (h > 0 && r > 0) {
      const calc = Math.round(h * r * 100) / 100
      setForm(f => ({ ...f, amount: String(calc) }))
    }
  }, [form.hours, form.rate])

  const pickPreset = (p) => {
    setForm(f => ({
      ...f,
      rate: String(p.rate),
      hours: f.hours || '1',
      notes: f.notes || p.name,
    }))
  }

  const addPreset = async () => {
    const r = Number(newPreset.rate)
    if (!newPreset.name.trim() || !(r > 0)) return
    const updated = [...presets, { id: crypto.randomUUID().slice(0, 8), name: newPreset.name.trim(), rate: r }]
    await onSavePresets(updated)
    setNewPreset({ name: '', rate: '' })
    setShowAddPreset(false)
  }

  const deletePreset = async (id) => {
    await onSavePresets(presets.filter(p => p.id !== id))
  }

  const pickExpensePreset = (p) => {
    setForm(f => ({
      ...f,
      notes: p.name,
      amount: p.amount ? String(p.amount) : f.amount,
    }))
  }

  const addExpensePreset = async () => {
    if (!newExpensePreset.name.trim()) return
    const amt = Number(newExpensePreset.amount)
    const entry = { id: crypto.randomUUID().slice(0, 8), name: newExpensePreset.name.trim() }
    if (amt > 0) entry.amount = amt
    await onSaveExpensePresets([...expensePresets, entry])
    setNewExpensePreset({ name: '', amount: '' })
    setShowAddExpensePreset(false)
  }

  const deleteExpensePreset = async (id) => {
    await onSaveExpensePresets(expensePresets.filter(p => p.id !== id))
  }

  const save = async () => {
    const amt = Number(form.amount)
    if (!amt || amt <= 0) return
    const h = Number(form.hours), r = Number(form.rate)
    let notes = form.notes.trim()
    if (h > 0 && r > 0 && !notes.includes('@')) {
      notes = notes ? `${notes} — ${h}hr @ $${r}/hr` : `${h}hr @ $${r}/hr`
    }
    await addDoc(collection(db, 'users', user.uid, 'money'), {
      type: form.type,
      date: form.date,
      amount: amt,
      paid: isExpense ? true : form.paid,
      notes,
      createdAt: Date.now(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div className="bg-zinc-900 rounded-t-3xl p-4 max-h-[88dvh] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] flex flex-col gap-3 overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto" />
        <p className="text-white font-semibold">New entry</p>

        <div className="grid grid-cols-3 gap-1.5">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setForm(f => ({ ...f, type: t.id }))}
              className={`py-2 rounded-xl text-xs font-semibold transition-all ${form.type === t.id ? `${t.bg} text-white` : 'bg-zinc-800 text-zinc-400'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {isExpense && (
          <div className="space-y-2">
            <p className="text-zinc-500 text-xs">Quick fill</p>
            <div className="flex gap-1.5 flex-wrap">
              {expensePresets.map(p => (
                <div key={p.id} className="flex items-center bg-zinc-800 rounded-full overflow-hidden">
                  <button onClick={() => pickExpensePreset(p)} className="px-2.5 py-1 text-xs font-medium text-zinc-300">
                    {p.name}{p.amount ? <span className="text-zinc-500"> ${p.amount}</span> : ''}
                  </button>
                  <button onClick={() => deleteExpensePreset(p.id)} className="px-1.5 py-1 text-zinc-600 active:text-red-400 text-xs">×</button>
                </div>
              ))}
              {!showAddExpensePreset && (
                <button onClick={() => setShowAddExpensePreset(true)} className="bg-zinc-800 text-zinc-500 px-2.5 py-1 rounded-full text-xs">
                  + Category
                </button>
              )}
            </div>
            {showAddExpensePreset && (
              <div className="flex gap-1.5 items-center bg-zinc-800 rounded-xl p-1.5">
                <input placeholder="Name" value={newExpensePreset.name} onChange={e => setNewExpensePreset(p => ({ ...p, name: e.target.value }))}
                  className="flex-1 bg-zinc-900 text-white rounded-lg px-2 py-1 text-xs outline-none" autoFocus />
                <span className="text-zinc-500 text-xs">$</span>
                <input type="number" inputMode="decimal" placeholder="amt (opt)" value={newExpensePreset.amount}
                  onChange={e => setNewExpensePreset(p => ({ ...p, amount: e.target.value }))}
                  className="w-20 bg-zinc-900 text-white rounded-lg px-2 py-1 text-xs outline-none" />
                <button onClick={addExpensePreset} className="bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-lg">Save</button>
                <button onClick={() => setShowAddExpensePreset(false)} className="text-zinc-500 text-xs px-1">×</button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-zinc-400 text-xs w-12">Date</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="flex-1 bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-500" />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-zinc-400 text-xs w-12">Amount</label>
          <div className="flex-1 flex items-center bg-zinc-800 rounded-xl px-3">
            <span className="text-zinc-500 text-sm">$</span>
            <input type="number" inputMode="decimal" placeholder="0.00" value={form.amount} autoFocus
              onChange={e => setForm(f => ({ ...f, amount: e.target.value, hours: '', rate: '' }))}
              className="flex-1 bg-transparent text-white py-2 px-2 text-sm outline-none" />
          </div>
        </div>

        <div className="bg-zinc-800/40 border border-zinc-800 rounded-xl p-3 space-y-2">
          <p className="text-zinc-500 text-xs">Or by the hour</p>

          {form.type === 'lesson' && (
            <div className="flex gap-1.5 flex-wrap">
              {presets.map(p => (
                <div key={p.id} className="flex items-center bg-zinc-800 rounded-full overflow-hidden">
                  <button onClick={() => pickPreset(p)}
                    className={`px-2.5 py-1 text-xs font-medium ${Number(form.rate) === p.rate ? 'text-purple-300' : 'text-zinc-300'}`}>
                    {p.name} <span className="text-zinc-500">${p.rate}/hr</span>
                  </button>
                  <button onClick={() => deletePreset(p.id)} className="px-1.5 py-1 text-zinc-600 active:text-red-400 text-xs">×</button>
                </div>
              ))}
              {!showAddPreset && (
                <button onClick={() => setShowAddPreset(true)} className="bg-zinc-800 text-zinc-500 px-2.5 py-1 rounded-full text-xs">
                  + Preset
                </button>
              )}
            </div>
          )}

          {form.type === 'lesson' && showAddPreset && (
            <div className="flex gap-1.5 items-center bg-zinc-800 rounded-xl p-1.5">
              <input placeholder="Name" value={newPreset.name} onChange={e => setNewPreset(p => ({ ...p, name: e.target.value }))}
                className="flex-1 bg-zinc-900 text-white rounded-lg px-2 py-1 text-xs outline-none" autoFocus />
              <span className="text-zinc-500 text-xs">$</span>
              <input type="number" inputMode="decimal" placeholder="rate/hr" value={newPreset.rate}
                onChange={e => setNewPreset(p => ({ ...p, rate: e.target.value }))}
                className="w-16 bg-zinc-900 text-white rounded-lg px-2 py-1 text-xs outline-none" />
              <button onClick={addPreset} className="bg-purple-500 text-white text-xs font-semibold px-2 py-1 rounded-lg">Save</button>
              <button onClick={() => setShowAddPreset(false)} className="text-zinc-500 text-xs px-1">×</button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="number" inputMode="decimal" placeholder="Hours" value={form.hours}
              onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
              className="flex-1 bg-zinc-800 text-white rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-green-500" />
            <span className="text-zinc-600 text-xs">×</span>
            <div className="flex-1 flex items-center bg-zinc-800 rounded-lg px-2">
              <span className="text-zinc-500 text-xs">$</span>
              <input type="number" inputMode="decimal" placeholder="rate" value={form.rate}
                onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
                className="flex-1 bg-transparent text-white py-1.5 px-1 text-sm outline-none" />
              <span className="text-zinc-500 text-xs">/hr</span>
            </div>
            {Number(form.hours) > 0 && Number(form.rate) > 0 && (
              <span className="text-green-400 text-xs font-bold">= {fmtMoney(Number(form.hours) * Number(form.rate))}</span>
            )}
          </div>
        </div>

        <input type="text" placeholder={t.placeholder}
          value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-500" />

        {!isExpense && (
          <button onClick={() => setForm(f => ({ ...f, paid: !f.paid }))}
            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all ${form.paid ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
            <span className="font-medium">{form.paid ? 'Paid' : 'Unpaid'}</span>
            <span className="text-xs opacity-70">tap to toggle</span>
          </button>
        )}

        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 bg-zinc-800 text-white py-2.5 rounded-xl text-sm">Cancel</button>
          <button onClick={save} disabled={!form.amount || Number(form.amount) <= 0}
            className="flex-1 bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold py-2.5 rounded-xl text-sm">
            Save
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
  const [showAdd, setShowAdd] = useState(false)
  const [presets, setPresets] = useState(DEFAULT_PRESETS)
  const [expensePresets, setExpensePresets] = useState(DEFAULT_EXPENSE_PRESETS)

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
    getDoc(doc(db, 'users', user.uid, 'settings', 'lessonRates')).then(snap => {
      if (snap.exists() && snap.data().presets) setPresets(snap.data().presets)
    })
    getDoc(doc(db, 'users', user.uid, 'settings', 'expensePresets')).then(snap => {
      if (snap.exists() && snap.data().presets) setExpensePresets(snap.data().presets)
    })
  }, [user])

  const savePresets = async (updated) => {
    setPresets(updated)
    await setDoc(doc(db, 'users', user.uid, 'settings', 'lessonRates'), { presets: updated }, { merge: true })
  }

  const saveExpensePresets = async (updated) => {
    setExpensePresets(updated)
    await setDoc(doc(db, 'users', user.uid, 'settings', 'expensePresets'), { presets: updated }, { merge: true })
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

  const togglePaid = async (entry) => {
    await updateDoc(doc(db, 'users', user.uid, 'money', entry.id), { paid: !entry.paid })
  }

  const remove = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'money', id))
  }

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-full bg-zinc-950 pb-24">
      <div className="sticky top-0 z-10 bg-zinc-950 px-4 pt-4 pb-3 border-b border-zinc-900">
        <h1 className="text-white font-bold text-lg">Money</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="bg-zinc-900 rounded-2xl p-4">
          <p className="text-zinc-500 text-xs uppercase tracking-widest mb-2">{monthLabel}</p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`text-3xl font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMoney(net)}</span>
            <span className="text-zinc-500 text-sm">net</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div className="bg-zinc-800 rounded-xl py-2">
              <p className="text-emerald-400 text-sm font-bold">{fmtMoney(income)}</p>
              <p className="text-zinc-600 text-xs">Income</p>
            </div>
            <div className="bg-zinc-800 rounded-xl py-2">
              <p className="text-amber-400 text-sm font-bold">{fmtMoney(unpaid)}</p>
              <p className="text-zinc-600 text-xs">Unpaid</p>
            </div>
            <div className="bg-zinc-800 rounded-xl py-2">
              <p className="text-red-400 text-sm font-bold">{fmtMoney(expenses)}</p>
              <p className="text-zinc-600 text-xs">Expenses</p>
            </div>
          </div>
          {byType.length > 0 && (
            <div className="flex gap-1.5 flex-wrap pt-2 border-t border-zinc-800">
              {byType.map(t => (
                <div key={t.id} className="flex items-center gap-1.5 bg-zinc-800 rounded-full px-2.5 py-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                  <span className="text-zinc-300 text-xs">{t.label}</span>
                  <span className="text-zinc-500 text-xs">{fmtMoney(t.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
          {[['all', 'All'], ['unpaid', 'Unpaid'], ...TYPES.map(t => [t.id, t.label + 's'])].map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter === id ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-zinc-600 text-sm text-center py-12">
              {entries.length === 0 ? 'Tap + to add your first entry' : 'Nothing here for this filter'}
            </p>
          )}
          {filtered.map(e => {
            const t = typeOf(e.type)
            const isExpense = e.type === 'expense'
            return (
              <div key={e.id} className="bg-zinc-900 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-1.5 self-stretch ${t.dot} rounded-full flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{t.label}</span>
                    {!isExpense && !e.paid && (
                      <button onClick={() => togglePaid(e)} className="bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                        Unpaid
                      </button>
                    )}
                    {!isExpense && e.paid && (
                      <button onClick={() => togglePaid(e)} className="text-zinc-600 text-[10px] uppercase tracking-wider">
                        Paid
                      </button>
                    )}
                  </div>
                  <p className="text-zinc-500 text-xs flex flex-wrap gap-x-1.5">
                    <span>{fmtDate(e.date)}</span>
                    {e.notes && <span className="text-zinc-400 truncate">· {e.notes}</span>}
                  </p>
                </div>
                <span className={`font-bold text-sm ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
                  {isExpense ? '−' : '+'}{fmtMoney(e.amount)}
                </span>
                <button onClick={() => remove(e.id)} className="text-zinc-700 active:text-red-400 p-1 flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <button onClick={() => setShowAdd(true)}
        className="fixed right-4 w-14 h-14 bg-green-500 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center active:scale-95 transition-transform z-40"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-black"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>

      {showAdd && <AddModal user={user} presets={presets} expensePresets={expensePresets}
        onSavePresets={savePresets} onSaveExpensePresets={saveExpensePresets} onClose={() => setShowAdd(false)} />}
    </div>
  )
}
