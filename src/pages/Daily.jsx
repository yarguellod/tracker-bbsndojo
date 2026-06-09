import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

import { toKey, fmt } from '../lib/date'

export default function Daily() {
  const { user } = useAuth()
  const [date, setDate] = useState(new Date())
  const [metrics, setMetrics] = useState({ steps: '', miles: '', weightAM: '', weightPM: '', supplementsDone: [] })
  const [supplements, setSupplements] = useState([])
  const [newSupp, setNewSupp] = useState('')
  const [showAddSupp, setShowAddSupp] = useState(false)

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
    if (!newSupp.trim()) return
    const ref = await addDoc(collection(db, 'users', user.uid, 'supplements'), { name: newSupp.trim() })
    setSupplements(s => [...s, { id: ref.id, name: newSupp.trim() }])
    setNewSupp('')
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

          {showAddSupp && (
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="e.g. B12, Creatine…"
                value={newSupp}
                onChange={e => setNewSupp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSupp()}
                className="flex-1 bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-500"
                autoFocus
              />
              <button onClick={addSupp} className="bg-green-500 text-black font-bold px-4 rounded-xl text-sm">Save</button>
            </div>
          )}

          {supplements.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-4">No supplements yet — tap + Add</p>
          ) : (
            <div className="space-y-2">
              {supplements.map(s => {
                const done = metrics.supplementsDone.includes(s.id)
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <button
                      onClick={() => toggleSupp(s.id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        done ? 'bg-purple-500 border-purple-500' : 'border-zinc-600'
                      }`}
                    >
                      {done && <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                    </button>
                    <span className={`flex-1 text-sm ${done ? 'text-zinc-500 line-through' : 'text-white'}`}>{s.name}</span>
                    <button onClick={() => deleteSupp(s.id)} className="text-zinc-700 active:text-red-400 p-1">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
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
