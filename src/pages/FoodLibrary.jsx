import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

function FoodForm({ onSave, onCancel, initial = {} }) {
  const [form, setForm] = useState({ name: '', serving: '', cal: '', protein: '', carbs: '', fat: '', fiber: '', ...initial })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const serving = Number(form.serving)
  const norm = (v) => serving > 0 ? Math.round((Number(v || 0) / serving) * 100 * 10) / 10 : 0

  return (
    <div className="bg-zinc-800 rounded-2xl p-4 space-y-3">
      <input placeholder="Food name *" value={form.name} onChange={set('name')}
        className="w-full bg-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-500" autoFocus />

      <div className="flex items-center gap-2">
        <label className="text-zinc-400 text-xs whitespace-nowrap">Values per</label>
        <input type="number" inputMode="decimal" placeholder="e.g. 170" value={form.serving} onChange={set('serving')}
          className="w-24 bg-zinc-700 text-white rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-1 focus:ring-green-500" />
        <span className="text-zinc-400 text-xs">grams *</span>
        {serving > 0 && serving !== 100 && form.cal && (
          <span className="text-zinc-500 text-xs ml-auto">→ {norm(form.cal)} kcal / 100g</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[['cal', 'Calories *'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g)'], ['fat', 'Fat (g)'], ['fiber', 'Fiber (g)']].map(([k, l]) => (
          <div key={k}>
            <label className="text-zinc-500 text-xs">{l}</label>
            <input type="number" inputMode="decimal" placeholder="0" value={form[k]} onChange={set(k)}
              className="w-full bg-zinc-700 text-white rounded-xl px-3 py-2 text-sm mt-0.5 outline-none focus:ring-1 focus:ring-green-500" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 bg-zinc-700 text-white py-2.5 rounded-xl text-sm font-semibold">Cancel</button>
        <button
          onClick={() => onSave({ name: form.name.trim(), cal: norm(form.cal), protein: norm(form.protein), carbs: norm(form.carbs), fat: norm(form.fat), fiber: norm(form.fiber) })}
          disabled={!form.name || !form.cal || !(serving > 0)}
          className="flex-1 bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold py-2.5 rounded-xl text-sm">
          Save
        </button>
      </div>
    </div>
  )
}

function CreateGroupModal({ user, foods, onSave, onClose }) {
  const [name, setName] = useState('')
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [grams, setGrams] = useState({})

  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
  const toggleFood = (f) => {
    setItems(i => i.find(x => x.foodId === f.id) ? i.filter(x => x.foodId !== f.id) : [...i, { foodId: f.id, foodName: f.name, grams: 100 }])
  }
  const updateGrams = (foodId, g) => {
    setItems(i => i.map(x => x.foodId === foodId ? { ...x, grams: Number(g) } : x))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-zinc-900 rounded-t-3xl p-4 max-h-[85dvh] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />
        <p className="text-white font-semibold mb-3">New Meal Group</p>
        <input placeholder="Group name (e.g. Usual Breakfast)" value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-500 mb-3" autoFocus />

        {items.length > 0 && (
          <div className="mb-3 space-y-2">
            <p className="text-zinc-400 text-xs font-medium">Selected foods</p>
            {items.map(item => (
              <div key={item.foodId} className="flex items-center gap-2 bg-zinc-800 rounded-xl px-3 py-2">
                <span className="flex-1 text-white text-sm truncate">{item.foodName}</span>
                <input type="number" value={item.grams} onChange={e => updateGrams(item.foodId, e.target.value)}
                  className="w-16 bg-zinc-700 text-white rounded-lg px-2 py-1 text-xs text-center outline-none" />
                <span className="text-zinc-500 text-xs">g</span>
              </div>
            ))}
          </div>
        )}

        <input placeholder="Search foods to add…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none mb-2" />
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {filtered.map(f => {
            const sel = items.find(x => x.foodId === f.id)
            return (
              <button key={f.id} onClick={() => toggleFood(f)}
                className={`w-full flex justify-between items-center rounded-xl px-3 py-2.5 active:opacity-80 ${sel ? 'bg-green-500/20' : 'bg-zinc-800'}`}>
                <span className="text-white text-sm">{f.name}</span>
                {sel && <span className="text-green-400 text-xs">✓ {sel.grams}g</span>}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => { if (name && items.length) onSave({ name, items }) }}
          disabled={!name || items.length === 0}
          className="mt-3 w-full bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold py-3 rounded-xl text-sm">
          Save Group ({items.length} foods)
        </button>
      </div>
    </div>
  )
}

export default function FoodLibrary() {
  const { user } = useAuth()
  const [tab, setTab] = useState('foods')
  const [foods, setFoods] = useState([])
  const [mealGroups, setMealGroups] = useState([])
  const [showAddFood, setShowAddFood] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => {
    const [fs, gs] = await Promise.all([
      getDocs(collection(db, 'users', user.uid, 'foods')),
      getDocs(collection(db, 'users', user.uid, 'mealGroups')),
    ])
    setFoods(fs.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)))
    setMealGroups(gs.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => { if (user) load() }, [user])

  const saveFood = async (data) => {
    const ref = await addDoc(collection(db, 'users', user.uid, 'foods'), data)
    setFoods(f => [...f, { id: ref.id, ...data }].sort((a, b) => a.name.localeCompare(b.name)))
    setShowAddFood(false)
  }

  const deleteFood = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'foods', id))
    setFoods(f => f.filter(x => x.id !== id))
  }

  const saveGroup = async (data) => {
    const ref = await addDoc(collection(db, 'users', user.uid, 'mealGroups'), data)
    setMealGroups(g => [...g, { id: ref.id, ...data }])
    setShowGroupModal(false)
  }

  const deleteGroup = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'mealGroups', id))
    setMealGroups(g => g.filter(x => x.id !== id))
  }

  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))

  const nameCount = foods.reduce((acc, f) => {
    const k = f.name.toLowerCase().trim()
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
  const duplicateCount = Object.values(nameCount).filter(n => n > 1).length

  return (
    <div className="min-h-full bg-zinc-950 pb-6">
      <div className="sticky top-0 z-10 bg-zinc-950 px-4 pt-4 pb-2 border-b border-zinc-900">
        <h1 className="text-white font-bold text-lg mb-3">Library</h1>
        <div className="flex gap-1 bg-zinc-800 rounded-xl p-1">
          {['foods', 'groups'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>
              {t === 'groups' ? 'Meal Groups' : 'Foods'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 space-y-3">
        {tab === 'foods' && (
          <>
            <div className="flex gap-2">
              <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-500" />
              <button onClick={() => setShowAddFood(v => !v)}
                className="bg-green-500 text-black font-bold px-4 rounded-xl text-sm">+ Add</button>
            </div>

            {showAddFood && <FoodForm onSave={saveFood} onCancel={() => setShowAddFood(false)} />}

            {duplicateCount > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-400 flex-shrink-0"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                <p className="text-amber-200 text-xs">
                  {duplicateCount} food name{duplicateCount !== 1 ? 's have' : ' has'} duplicates — review and delete extras below
                </p>
              </div>
            )}

            {filtered.length === 0 && !showAddFood && (
              <p className="text-zinc-600 text-sm text-center py-12">No foods yet — tap + Add to build your library</p>
            )}

            <div className="space-y-2">
              {filtered.map(f => {
                const isDup = nameCount[f.name.toLowerCase().trim()] > 1
                return (
                  <div key={f.id} className={`rounded-xl px-4 py-3 flex items-center gap-3 ${isDup ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : 'bg-zinc-900'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium truncate">{f.name}</p>
                        {isDup && <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider flex-shrink-0">Dup</span>}
                      </div>
                      <p className="text-zinc-500 text-xs">{f.cal} kcal · P {f.protein}g · C {f.carbs}g · F {f.fat}g <span className="text-zinc-600">per 100g</span></p>
                    </div>
                    <button onClick={() => deleteFood(f.id)} className="text-zinc-700 active:text-red-400 p-1">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {tab === 'groups' && (
          <>
            <button onClick={() => setShowGroupModal(true)}
              className="w-full bg-green-500 text-black font-bold py-3 rounded-xl text-sm">+ New Meal Group</button>

            {mealGroups.length === 0 && (
              <p className="text-zinc-600 text-sm text-center py-12">
                No meal groups yet{'\n'}Create one to quickly load repeated meals
              </p>
            )}

            <div className="space-y-2">
              {mealGroups.map(g => (
                <div key={g.id} className="bg-zinc-900 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{g.name}</p>
                    <p className="text-zinc-500 text-xs">{g.items?.length ?? 0} foods</p>
                    <p className="text-zinc-600 text-xs truncate mt-0.5">{g.items?.map(i => i.foodName).join(', ')}</p>
                  </div>
                  <button onClick={() => deleteGroup(g.id)} className="text-zinc-700 active:text-red-400 p-1">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showGroupModal && <CreateGroupModal user={user} foods={foods} onSave={saveGroup} onClose={() => setShowGroupModal(false)} />}
    </div>
  )
}
