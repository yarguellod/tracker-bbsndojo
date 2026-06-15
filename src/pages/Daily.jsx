import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

import { toKey, fmt } from '../lib/date'

const FREQUENCIES = ['Daily', 'Morning', 'Evening', 'Pre-workout', 'Post-workout', 'With meals']

const COLORS = [
  { name: 'red',     bg: 'bg-red-500',     text: 'text-red-200',     shadow: 'shadow-red-500/30',     dot: 'bg-red-500' },
  { name: 'orange',  bg: 'bg-orange-500',  text: 'text-orange-200',  shadow: 'shadow-orange-500/30',  dot: 'bg-orange-500' },
  { name: 'amber',   bg: 'bg-amber-500',   text: 'text-amber-100',   shadow: 'shadow-amber-500/30',   dot: 'bg-amber-500' },
  { name: 'emerald', bg: 'bg-emerald-500', text: 'text-emerald-200', shadow: 'shadow-emerald-500/30', dot: 'bg-emerald-500' },
  { name: 'teal',    bg: 'bg-teal-500',    text: 'text-teal-200',    shadow: 'shadow-teal-500/30',    dot: 'bg-teal-500' },
  { name: 'blue',    bg: 'bg-blue-500',    text: 'text-blue-200',    shadow: 'shadow-blue-500/30',    dot: 'bg-blue-500' },
  { name: 'purple',  bg: 'bg-purple-500',  text: 'text-purple-200',  shadow: 'shadow-purple-500/30',  dot: 'bg-purple-500' },
  { name: 'pink',    bg: 'bg-pink-500',    text: 'text-pink-200',    shadow: 'shadow-pink-500/30',    dot: 'bg-pink-500' },
]

const SUGGESTED_COLORS = {
  finasteride: 'blue', 'vitamin d': 'amber', 'vit d': 'amber',
  'omega 3': 'teal', 'omega-3': 'teal', fish: 'teal',
  creatine: 'red', b12: 'pink', zinc: 'emerald', magnesium: 'purple', iron: 'orange',
}

const suggestColor = (name) => {
  const n = name.toLowerCase().trim()
  if (!n) return COLORS[Math.floor(Math.random() * COLORS.length)].name
  for (const [key, color] of Object.entries(SUGGESTED_COLORS)) {
    if (n.includes(key)) return color
  }
  return COLORS[Math.floor(Math.random() * COLORS.length)].name
}

const colorOf = (name) => COLORS.find(c => c.name === name) || COLORS.find(c => c.name === 'purple')

const getInitials = (name) => {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

export default function Daily() {
  const { user } = useAuth()
  const [date, setDate] = useState(new Date())
  const [metrics, setMetrics] = useState({ steps: '', miles: '', weightAM: '', weightPM: '', supplementsDone: [] })
  const [supplements, setSupplements] = useState([])
  const [showAddSupp, setShowAddSupp] = useState(false)
  const [suppForm, setSuppForm] = useState({ name: '', frequency: 'Daily', color: 'purple', colorTouched: false })

  useEffect(() => {
    if (!user) return
    getDocs(collection(db, 'users', user.uid, 'supplements')).then(snap => {
      setSupplements(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [user])

  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'logs', toKey(date))
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const m = snap.data().metrics ?? {}
        setMetrics({
          steps: m.steps ?? '',
          miles: m.miles ?? '',
          weightAM: m.weightAM ?? '',
          weightPM: m.weightPM ?? '',
          supplementsDone: m.supplementsDone ?? [],
        })
      } else {
        setMetrics({ steps: '', miles: '', weightAM: '', weightPM: '', supplementsDone: [] })
      }
    })
    return unsub
  }, [user, date])

  const save = async (updated) => {
    const m = { ...metrics, ...updated }
    const clean = {}
    if (m.steps !== '') clean.steps = Number(m.steps)
    if (m.miles !== '') clean.miles = Number(m.miles)
    if (m.weightAM !== '') clean.weightAM = Number(m.weightAM)
    if (m.weightPM !== '') clean.weightPM = Number(m.weightPM)
    clean.supplementsDone = m.supplementsDone
    await setDoc(doc(db, 'users', user.uid, 'logs', toKey(date)), { metrics: clean }, { merge: true })
  }

  const toggleSupp = (id) => {
    const done = metrics.supplementsDone.includes(id)
      ? metrics.supplementsDone.filter(s => s !== id)
      : [...metrics.supplementsDone, id]
    setMetrics(m => ({ ...m, supplementsDone: done }))
    save({ supplementsDone: done })
  }

  const addSupp = async () => {
    if (!suppForm.name.trim()) return
    const data = { name: suppForm.name.trim(), frequency: suppForm.frequency, color: suppForm.color }
    const ref = await addDoc(collection(db, 'users', user.uid, 'supplements'), data)
    setSupplements(s => [...s, { id: ref.id, ...data }])
    setSuppForm({ name: '', frequency: 'Daily', color: 'purple', colorTouched: false })
    setShowAddSupp(false)
  }

  const deleteSupp = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'supplements', id))
    setSupplements(s => s.filter(x => x.id !== id))
    const done = metrics.supplementsDone.filter(s => s !== id)
    setMetrics(m => ({ ...m, supplementsDone: done }))
    save({ supplementsDone: done })
  }

  const shift = (n) => {
    const d = new Date(date)
    d.setDate(d.getDate() + n)
    setDate(d)
  }

  const isToday = toKey(date) === toKey(new Date())

  return (
    <div className="min-h-full bg-zinc-950 pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950 px-4 pt-4 pb-2 flex items-center justify-between border-b border-zinc-900">
        <button onClick={() => shift(-1)} className="p-2 text-zinc-400"><svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>
        <div className="text-center">
          <p className="text-white font-semibold text-sm">{fmt(date)}</p>
          {isToday && <p className="text-green-400 text-xs">Today</p>}
        </div>
        <button onClick={() => shift(1)} className="p-2 text-zinc-400"><svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Weight */}
        <div className="bg-zinc-900 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest mb-3">Weight</p>
          <div className="grid grid-cols-2 gap-3">
            {[['weightAM', 'Morning (AM)'], ['weightPM', 'Bedtime (PM)']].map(([key, label]) => (
              <div key={key}>
                <label className="text-zinc-500 text-xs mb-1 block">{label}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={metrics[key]}
                  onChange={e => setMetrics(m => ({ ...m, [key]: e.target.value }))}
                  onBlur={() => save({})}
                  className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="bg-zinc-900 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest mb-3">Activity</p>
          <div className="grid grid-cols-2 gap-3">
            {[['steps', 'Steps', '0'], ['miles', 'Miles', '0.0']].map(([key, label, ph]) => (
              <div key={key}>
                <label className="text-zinc-500 text-xs mb-1 block">{label}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder={ph}
                  value={metrics[key]}
                  onChange={e => setMetrics(m => ({ ...m, [key]: e.target.value }))}
                  onBlur={() => save({})}
                  className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Supplements */}
        <div className="bg-zinc-900 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Supplements</p>
            <button onClick={() => setShowAddSupp(v => !v)} className="text-green-400 text-xs font-medium">+ Add</button>
          </div>

          {showAddSupp && (() => {
            const previewColor = colorOf(suppForm.color)
            return (
              <div className="mb-3 space-y-2">
                <input autoFocus placeholder="Supplement name (e.g. Creatine, B12…)"
                  value={suppForm.name}
                  onChange={e => setSuppForm(f => ({ ...f, name: e.target.value, color: f.colorTouched ? f.color : suggestColor(e.target.value) }))}
                  onKeyDown={e => e.key === 'Enter' && addSupp()}
                  className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-500" />
                <div className="flex gap-1.5 flex-wrap">
                  {FREQUENCIES.map(f => (
                    <button key={f} onClick={() => setSuppForm(x => ({ ...x, frequency: f }))}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${suppForm.frequency === f ? `${previewColor.bg} text-white` : 'bg-zinc-800 text-zinc-400'}`}>
                      {f}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-xs">Color</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {COLORS.map(c => (
                      <button key={c.name} onClick={() => setSuppForm(x => ({ ...x, color: c.name, colorTouched: true }))}
                        className={`w-7 h-7 rounded-full ${c.dot} transition-all ${suppForm.color === c.name ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : 'opacity-70'}`}
                        aria-label={c.name} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddSupp(false)} className="flex-1 bg-zinc-800 text-white py-2 rounded-xl text-sm">Cancel</button>
                  <button onClick={addSupp} disabled={!suppForm.name.trim()}
                    className={`flex-1 ${previewColor.bg} disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold py-2 rounded-xl text-sm`}>
                    Add Supplement
                  </button>
                </div>
              </div>
            )
          })()}

          {supplements.length === 0 && !showAddSupp ? (
            <p className="text-zinc-600 text-sm text-center py-4">No supplements yet — tap + Add</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {supplements.map(s => {
                const taken = metrics.supplementsDone.includes(s.id)
                const c = colorOf(s.color)
                return (
                  <div key={s.id} className="flex flex-col items-center gap-1">
                    <button onClick={() => toggleSupp(s.id)}
                      className={`flex flex-col items-center px-4 py-2 rounded-full font-bold transition-all active:scale-95 ${
                        taken ? `${c.bg} text-white shadow-lg ${c.shadow}` : 'bg-zinc-800 text-zinc-400'
                      }`}>
                      <span className="text-sm font-extrabold tracking-wide">{getInitials(s.name)}</span>
                      <span className={`text-xs font-normal leading-tight ${taken ? c.text : 'text-zinc-600'}`}>{s.frequency || 'Daily'}</span>
                    </button>
                    <button onClick={() => deleteSupp(s.id)} className="text-zinc-700 active:text-red-400 text-sm leading-none">×</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
