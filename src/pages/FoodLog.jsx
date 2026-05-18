import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const toKey = (d) => d.toISOString().slice(0, 10)
const fmt = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const calc = (food, grams) => ({
  cal: Math.round((grams / 100) * food.cal),
  protein: Math.round((grams / 100) * food.protein * 10) / 10,
  carbs: Math.round((grams / 100) * food.carbs * 10) / 10,
  fat: Math.round((grams / 100) * food.fat * 10) / 10,
})

function AddFoodModal({ user, onAdd, onClose }) {
  const [tab, setTab] = useState('library')
  const [foods, setFoods] = useState([])
  const [mealGroups, setMealGroups] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [grams, setGrams] = useState('')
  const [custom, setCustom] = useState({ name: '', cal: '', protein: '', carbs: '', fat: '' })
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5))

  useEffect(() => {
    getDocs(collection(db, 'users', user.uid, 'foods')).then(s =>
      setFoods(s.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    getDocs(collection(db, 'users', user.uid, 'mealGroups')).then(s =>
      setMealGroups(s.docs.map(d => ({ id: d.id, ...d.data() })))
    )
  }, [user])

  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))

  const addFromLibrary = () => {
    if (!selected || !grams) return
    const macros = calc(selected, Number(grams))
    onAdd({ id: crypto.randomUUID(), time, foodName: selected.name, foodId: selected.id, grams: Number(grams), ...macros })
  }

  const addCustom = () => {
    if (!custom.name || !custom.cal) return
    onAdd({
      id: crypto.randomUUID(), time, foodName: custom.name, isCustom: true,
      cal: Number(custom.cal), protein: Number(custom.protein || 0),
      carbs: Number(custom.carbs || 0), fat: Number(custom.fat || 0),
    })
  }

  const loadGroup = (group) => {
    const entries = group.items.map(item => {
      const food = foods.find(f => f.id === item.foodId)
      if (!food) return null
      const macros = calc(food, item.grams)
      return { id: crypto.randomUUID(), time, foodName: food.name, foodId: food.id, grams: item.grams, ...macros }
    }).filter(Boolean)
    entries.forEach(onAdd)
    onClose()
  }

  const preview = selected && grams ? calc(selected, Number(grams)) : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-zinc-900 rounded-t-3xl p-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />

        {/* Time */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-zinc-400 text-sm">Time</span>
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="bg-zinc-800 text-white rounded-lg px-2 py-1 text-sm outline-none" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-800 rounded-xl p-1 mb-4">
          {['library', 'custom', 'groups'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>
              {t === 'groups' ? 'Meal Groups' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === 'library' && (
            <div className="space-y-3">
              <input type="text" placeholder="Search foods…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-500" autoFocus />

              {selected ? (
                <div className="bg-zinc-800 rounded-xl p-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium text-sm">{selected.name}</span>
                    <button onClick={() => { setSelected(null); setGrams('') }} className="text-zinc-500 text-xs">Change</button>
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs">Grams</label>
                    <input type="number" inputMode="decimal" placeholder="100" value={grams} onChange={e => setGrams(e.target.value)}
                      className="w-full bg-zinc-700 text-white rounded-lg px-3 py-2 text-sm mt-1 outline-none" autoFocus />
                  </div>
                  {preview && (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[['Cal', preview.cal, 'text-green-400'], ['P', preview.protein + 'g', 'text-blue-400'], ['C', preview.carbs + 'g', 'text-amber-400'], ['F', preview.fat + 'g', 'text-orange-400']].map(([l, v, c]) => (
                        <div key={l} className="bg-zinc-700 rounded-lg p-2">
                          <p className={`text-sm font-bold ${c}`}>{v}</p>
                          <p className="text-zinc-500 text-xs">{l}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={addFromLibrary} disabled={!grams}
                    className="w-full bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold py-3 rounded-xl text-sm">
                    Add to Log
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.length === 0 && <p className="text-zinc-600 text-sm text-center py-8">No foods found — add them in Library</p>}
                  {filtered.map(f => (
                    <button key={f.id} onClick={() => setSelected(f)}
                      className="w-full flex justify-between items-center bg-zinc-800 rounded-xl px-3 py-3 active:bg-zinc-700">
                      <span className="text-white text-sm">{f.name}</span>
                      <span className="text-zinc-500 text-xs">{f.cal} kcal · {f.protein}g P</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'custom' && (
            <div className="space-y-3">
              <input type="text" placeholder="Food name" value={custom.name} onChange={e => setCustom(c => ({ ...c, name: e.target.value }))}
                className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-500" autoFocus />
              <div className="grid grid-cols-2 gap-2">
                {[['cal', 'Calories *', '0'], ['protein', 'Protein (g)', '0'], ['carbs', 'Carbs (g)', '0'], ['fat', 'Fat (g)', '0']].map(([k, l, p]) => (
                  <div key={k}>
                    <label className="text-zinc-500 text-xs">{l}</label>
                    <input type="number" inputMode="decimal" placeholder={p} value={custom[k]} onChange={e => setCustom(c => ({ ...c, [k]: e.target.value }))}
                      className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm mt-1 outline-none focus:ring-1 focus:ring-green-500" />
                  </div>
                ))}
              </div>
              <button onClick={addCustom} disabled={!custom.name || !custom.cal}
                className="w-full bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold py-3 rounded-xl text-sm">
                Add to Log
              </button>
            </div>
          )}

          {tab === 'groups' && (
            <div className="space-y-2">
              {mealGroups.length === 0 && <p className="text-zinc-600 text-sm text-center py-8">No meal groups yet — create them in Library</p>}
              {mealGroups.map(g => (
                <button key={g.id} onClick={() => loadGroup(g)}
                  className="w-full flex justify-between items-center bg-zinc-800 rounded-xl px-4 py-3 active:bg-zinc-700">
                  <div className="text-left">
                    <p className="text-white text-sm font-medium">{g.name}</p>
                    <p className="text-zinc-500 text-xs">{g.items?.length ?? 0} foods</p>
                  </div>
                  <span className="text-green-400 text-sm">Load →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FoodLog() {
  const { user } = useAuth()
  const [date, setDate] = useState(new Date())
  const [entries, setEntries] = useState([])
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'logs', toKey(date))
    const unsub = onSnapshot(ref, snap => {
      setEntries(snap.exists() ? (snap.data().foodEntries ?? []) : [])
    })
    return unsub
  }, [user, date])

  const saveEntries = async (updated) => {
    await setDoc(doc(db, 'users', user.uid, 'logs', toKey(date)), { foodEntries: updated }, { merge: true })
  }

  const addEntry = (entry) => {
    const updated = [...entries, entry].sort((a, b) => a.time.localeCompare(b.time))
    setEntries(updated)
    saveEntries(updated)
    setShowModal(false)
  }

  const removeEntry = (id) => {
    const updated = entries.filter(e => e.id !== id)
    setEntries(updated)
    saveEntries(updated)
  }

  const totals = entries.reduce((s, e) => ({
    cal: s.cal + (e.cal || 0),
    protein: s.protein + (e.protein || 0),
    carbs: s.carbs + (e.carbs || 0),
    fat: s.fat + (e.fat || 0),
  }), { cal: 0, protein: 0, carbs: 0, fat: 0 })

  const shift = (n) => { const d = new Date(date); d.setDate(d.getDate() + n); setDate(d) }
  const isToday = toKey(date) === toKey(new Date())

  return (
    <div className="min-h-full bg-zinc-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950 px-4 pt-4 pb-2 flex items-center justify-between border-b border-zinc-900">
        <button onClick={() => shift(-1)} className="p-2 text-zinc-400"><svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>
        <div className="text-center">
          <p className="text-white font-semibold text-sm">{fmt(date)}</p>
          {isToday && <p className="text-green-400 text-xs">Today</p>}
        </div>
        <button onClick={() => shift(1)} className="p-2 text-zinc-400"><svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>
      </div>

      {/* Totals bar */}
      <div className="bg-zinc-900 mx-4 mt-3 rounded-2xl p-3 grid grid-cols-4 text-center">
        {[['Cal', Math.round(totals.cal), 'text-green-400'], ['P', Math.round(totals.protein) + 'g', 'text-blue-400'], ['C', Math.round(totals.carbs) + 'g', 'text-amber-400'], ['F', Math.round(totals.fat) + 'g', 'text-orange-400']].map(([l, v, c]) => (
          <div key={l}>
            <p className={`text-base font-bold ${c}`}>{v}</p>
            <p className="text-zinc-600 text-xs">{l}</p>
          </div>
        ))}
      </div>

      {/* Entries */}
      <div className="px-4 mt-3 space-y-2">
        {entries.length === 0 && (
          <div className="text-center py-16">
            <p className="text-zinc-600 text-sm">No food logged yet</p>
            <p className="text-zinc-700 text-xs mt-1">Tap + to add your first entry</p>
          </div>
        )}
        {entries.map(e => (
          <div key={e.id} className="bg-zinc-900 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-zinc-600 text-xs w-10 flex-shrink-0">{e.time}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{e.foodName}</p>
              <p className="text-zinc-500 text-xs">
                {e.grams ? `${e.grams}g · ` : ''}{e.cal} kcal
                {e.protein > 0 ? ` · P ${e.protein}g` : ''}
                {e.carbs > 0 ? ` · C ${e.carbs}g` : ''}
                {e.fat > 0 ? ` · F ${e.fat}g` : ''}
              </p>
            </div>
            <button onClick={() => removeEntry(e.id)} className="text-zinc-700 active:text-red-400 p-1 flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-green-500 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center active:scale-95 transition-transform z-40"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-black"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>

      {showModal && <AddFoodModal user={user} onAdd={addEntry} onClose={() => setShowModal(false)} />}
    </div>
  )
}
