import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore'
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
const getInitials = (name) => {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 3)
}
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
  finasteride: 'blue',
  'vitamin d': 'amber',
  'vit d': 'amber',
  'omega 3': 'teal',
  'omega-3': 'teal',
  fish: 'teal',
  creatine: 'red',
  b12: 'pink',
  zinc: 'emerald',
  magnesium: 'purple',
  iron: 'orange',
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

function SuppPills({ supplements, setSupplements, done, onToggle, userId }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', frequency: 'Daily', color: 'purple', colorTouched: false })

  const onNameChange = (val) => {
    setForm(f => ({
      ...f,
      name: val,
      color: f.colorTouched ? f.color : suggestColor(val),
    }))
  }

  const addSupp = async () => {
    if (!form.name.trim()) return
    const data = { name: form.name.trim(), frequency: form.frequency, color: form.color }
    const ref = await addDoc(collection(db, 'users', userId, 'supplements'), data)
    setSupplements(s => [...s, { id: ref.id, ...data }])
    setForm({ name: '', frequency: 'Daily', color: 'purple', colorTouched: false })
    setShowAdd(false)
  }

  const deleteSupp = async (id) => {
    await deleteDoc(doc(db, 'users', userId, 'supplements', id))
    setSupplements(s => s.filter(x => x.id !== id))
  }

  const previewColor = colorOf(form.color)

  return (
    <div className="border-b border-zinc-900">
      <div className="flex gap-2 overflow-x-auto px-4 py-3 items-start" style={{ scrollbarWidth: 'none' }}>
        {supplements.map(s => {
          const taken = done.includes(s.id)
          const c = colorOf(s.color)
          return (
            <div key={s.id} className="flex-shrink-0 flex flex-col items-center gap-1">
              <button
                onClick={() => onToggle(s.id)}
                className={`flex flex-col items-center px-4 py-2 rounded-full font-bold transition-all active:scale-95 ${
                  taken ? `${c.bg} text-white shadow-lg ${c.shadow}` : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <span className="text-sm font-extrabold tracking-wide">{getInitials(s.name)}</span>
                <span className={`text-xs font-normal leading-tight ${taken ? c.text : 'text-zinc-600'}`}>
                  {s.frequency}
                </span>
              </button>
              <button onClick={() => deleteSupp(s.id)} className="text-zinc-700 active:text-red-400 text-sm leading-none">×</button>
            </div>
          )
        })}
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-800 border-2 border-dashed border-zinc-700 flex items-center justify-center text-zinc-500 text-2xl active:bg-zinc-700"
        >+</button>
      </div>

      {showAdd && (
        <div className="px-4 pb-4 space-y-2">
          <input autoFocus placeholder="Supplement name (e.g. Creatine, B12…)"
            value={form.name} onChange={e => onNameChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSupp()}
            className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-500" />
          <div className="flex gap-1.5 flex-wrap">
            {FREQUENCIES.map(f => (
              <button key={f} onClick={() => setForm(x => ({ ...x, frequency: f }))}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${form.frequency === f ? `${previewColor.bg} text-white` : 'bg-zinc-800 text-zinc-400'}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-xs">Color</span>
            <div className="flex gap-1.5 flex-wrap">
              {COLORS.map(c => (
                <button key={c.name} onClick={() => setForm(x => ({ ...x, color: c.name, colorTouched: true }))}
                  className={`w-7 h-7 rounded-full ${c.dot} transition-all ${form.color === c.name ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : 'opacity-70'}`}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 bg-zinc-800 text-white py-2 rounded-xl text-sm">Cancel</button>
            <button onClick={addSupp} disabled={!form.name.trim()}
              className={`flex-1 ${previewColor.bg} disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold py-2 rounded-xl text-sm`}>
              Add Supplement
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MiniDashboard({ totals }) {
  return (
    <div className="mx-4 mt-3 bg-zinc-900 rounded-2xl p-4">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold text-green-400">{Math.round(totals.cal)}</span>
        <span className="text-zinc-500 text-sm">kcal eaten today</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['Protein', totals.protein, 'text-blue-400'], ['Carbs', totals.carbs, 'text-amber-400'], ['Fat', totals.fat, 'text-orange-400']].map(([l, v, c]) => (
          <div key={l} className="bg-zinc-800 rounded-xl py-2">
            <p className={`text-sm font-bold ${c}`}>{Math.round(v * 10) / 10}g</p>
            <p className="text-zinc-600 text-xs">{l}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function AddFoodModal({ user, onAdd, onClose }) {
  const [tab, setTab] = useState('library')
  const [foods, setFoods] = useState([])
  const [mealGroups, setMealGroups] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [grams, setGrams] = useState('100')
  const [custom, setCustom] = useState({ name: '', serving: '100', cal: '', protein: '', carbs: '', fat: '' })
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5))

  useEffect(() => {
    getDocs(collection(db, 'users', user.uid, 'foods')).then(s => setFoods(s.docs.map(d => ({ id: d.id, ...d.data() }))))
    getDocs(collection(db, 'users', user.uid, 'mealGroups')).then(s => setMealGroups(s.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [user])

  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))

  const addFromLibrary = () => {
    if (!selected || !grams) return
    const macros = calc(selected, Number(grams))
    onAdd({ id: crypto.randomUUID(), time, foodName: selected.name, foodId: selected.id, grams: Number(grams), ...macros })
  }

  const addCustom = async () => {
    if (!custom.name || !custom.cal) return
    const serving = Number(custom.serving) || 100
    const cal = Number(custom.cal), protein = Number(custom.protein || 0), carbs = Number(custom.carbs || 0), fat = Number(custom.fat || 0)

    const per100 = (v) => Math.round((v / serving) * 100 * 10) / 10
    try {
      await addDoc(collection(db, 'users', user.uid, 'foods'), {
        name: custom.name.trim(),
        cal: per100(cal), protein: per100(protein), carbs: per100(carbs), fat: per100(fat), fiber: 0,
      })
    } catch (e) { /* still log the entry even if library save fails */ }

    onAdd({ id: crypto.randomUUID(), time, foodName: custom.name.trim(), isCustom: true,
      grams: serving, cal, protein, carbs, fat })
  }

  const loadGroup = (group) => {
    group.items.forEach(item => {
      const food = foods.find(f => f.id === item.foodId)
      if (!food) return
      onAdd({ id: crypto.randomUUID(), time, foodName: food.name, foodId: food.id, grams: item.grams, ...calc(food, item.grams) })
    })
    onClose()
  }

  const preview = selected && grams ? calc(selected, Number(grams)) : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div className="bg-zinc-900 rounded-t-3xl p-4 max-h-[88dvh] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />
        <div className="flex items-center gap-3 mb-3">
          <span className="text-zinc-400 text-sm">Time</span>
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="bg-zinc-800 text-white rounded-lg px-3 py-1.5 text-sm outline-none flex-1" />
        </div>
        <div className="flex gap-1 bg-zinc-800 rounded-xl p-1 mb-4">
          {[['library', 'Library'], ['custom', 'Custom'], ['groups', 'Meal Groups']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
          {tab === 'library' && (
            <>
              {!selected && (
                <input type="text" placeholder="Search foods…" value={search} onChange={e => setSearch(e.target.value)} autoFocus
                  className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-500" />
              )}
              {selected ? (
                <div className="bg-zinc-800 rounded-xl p-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium text-sm">{selected.name}</span>
                    <button onClick={() => { setSelected(null); setGrams('100') }} className="text-zinc-500 text-xs">Change</button>
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs block mb-1">Grams</label>
                    <input type="number" inputMode="decimal" value={grams} onChange={e => setGrams(e.target.value)} autoFocus
                      className="w-full bg-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm outline-none" />
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
                    <button key={f.id} onClick={() => { setSelected(f); setGrams('100') }}
                      className="w-full flex justify-between items-center bg-zinc-800 rounded-xl px-3 py-3 active:bg-zinc-700">
                      <span className="text-white text-sm">{f.name}</span>
                      <span className="text-zinc-500 text-xs">{f.cal} kcal · {f.protein}g P</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'custom' && (
            <>
              <input type="text" placeholder="Food name" value={custom.name} autoFocus
                onChange={e => setCustom(c => ({ ...c, name: e.target.value }))}
                className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-500" />
              <div className="flex items-center gap-2">
                <label className="text-zinc-400 text-xs">For</label>
                <input type="number" inputMode="decimal" value={custom.serving}
                  onChange={e => setCustom(c => ({ ...c, serving: e.target.value }))}
                  className="w-20 bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-1 focus:ring-green-500" />
                <span className="text-zinc-400 text-xs">grams</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[['cal', 'Calories *'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g)'], ['fat', 'Fat (g)']].map(([k, l]) => (
                  <div key={k}>
                    <label className="text-zinc-500 text-xs">{l}</label>
                    <input type="number" inputMode="decimal" placeholder="0" value={custom[k]}
                      onChange={e => setCustom(c => ({ ...c, [k]: e.target.value }))}
                      className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm mt-0.5 outline-none focus:ring-1 focus:ring-green-500" />
                  </div>
                ))}
              </div>
              <p className="text-zinc-600 text-xs">Also saved to your Library (normalized to per-100g)</p>
              <button onClick={addCustom} disabled={!custom.name || !custom.cal}
                className="w-full bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold py-3 rounded-xl text-sm">
                Add to Log
              </button>
            </>
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
  const [supplements, setSupplements] = useState([])
  const [suppDone, setSuppDone] = useState([])
  const [showModal, setShowModal] = useState(false)

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
        setEntries(snap.data().foodEntries ?? [])
        setSuppDone(snap.data().metrics?.supplementsDone ?? [])
      } else {
        setEntries([])
        setSuppDone([])
      }
    })
    return unsub
  }, [user, date])

  const saveEntries = async (updated) => {
    await setDoc(doc(db, 'users', user.uid, 'logs', toKey(date)), { foodEntries: updated }, { merge: true })
  }

  const toggleSupp = async (id) => {
    const updated = suppDone.includes(id) ? suppDone.filter(s => s !== id) : [...suppDone, id]
    setSuppDone(updated)
    await setDoc(doc(db, 'users', user.uid, 'logs', toKey(date)), { metrics: { supplementsDone: updated } }, { merge: true })
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
    cal: s.cal + (e.cal || 0), protein: s.protein + (e.protein || 0),
    carbs: s.carbs + (e.carbs || 0), fat: s.fat + (e.fat || 0),
  }), { cal: 0, protein: 0, carbs: 0, fat: 0 })

  const shift = (n) => { const d = new Date(date); d.setDate(d.getDate() + n); setDate(d) }
  const isToday = toKey(date) === toKey(new Date())

  return (
    <div className="min-h-full bg-zinc-950 pb-24">
      <div className="sticky top-0 z-10 bg-zinc-950 px-4 pt-4 pb-2 flex items-center justify-between border-b border-zinc-900">
        <button onClick={() => shift(-1)} className="p-2 text-zinc-400 active:text-white">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
        <div className="text-center">
          <p className="text-white font-semibold text-sm">{fmt(date)}</p>
          {isToday && <p className="text-green-400 text-xs">Today</p>}
        </div>
        <button onClick={() => shift(1)} className="p-2 text-zinc-400 active:text-white">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </button>
      </div>

      <SuppPills supplements={supplements} setSupplements={setSupplements} done={suppDone} onToggle={toggleSupp} userId={user?.uid} />
      <MiniDashboard totals={totals} />

      <div className="px-4 mt-3 space-y-2">
        {entries.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-600 text-sm">Nothing logged yet</p>
            <p className="text-zinc-700 text-xs mt-1">Tap + to add your first entry</p>
          </div>
        )}
        {entries.map(e => (
          <div key={e.id} className="bg-zinc-900 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-zinc-600 text-xs w-10 flex-shrink-0">{e.time}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{e.foodName}</p>
              <p className="text-zinc-500 text-xs flex flex-wrap gap-x-1.5">
                {e.grams ? <span>{e.grams}g</span> : null}
                <span className="text-green-400">{e.cal} kcal</span>
                {e.protein > 0 && <span className="text-blue-400">P {e.protein}g</span>}
                {e.carbs > 0 && <span className="text-amber-400">C {e.carbs}g</span>}
                {e.fat > 0 && <span className="text-orange-400">F {e.fat}g</span>}
              </p>
            </div>
            <button onClick={() => removeEntry(e.id)} className="text-zinc-700 active:text-red-400 p-1 flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        ))}
      </div>

      <button onClick={() => setShowModal(true)}
        className="fixed right-4 w-14 h-14 bg-green-500 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center active:scale-95 transition-transform z-40"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-black"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>

      {showModal && <AddFoodModal user={user} onAdd={addEntry} onClose={() => setShowModal(false)} />}
    </div>
  )
}
