import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

import { toPer100g } from '../lib/macros'

const ADMIN_UID = import.meta.env.VITE_ADMIN_UID

function FoodForm({ onSave, onCancel, initial = {}, saveLabel = 'Save' }) {
  const serving100 = initial.defaultServing && initial.defaultServing !== 100 ? initial.defaultServing : 100
  const toRaw = (v100, srv) => srv > 0 && srv !== 100 ? Math.round((v100 / 100) * srv * 10) / 10 : v100

  const [form, setForm] = useState({
    name: initial.name ?? '',
    serving: initial.defaultServing ? String(initial.defaultServing) : '',
    cal: initial.cal != null ? String(toRaw(initial.cal, initial.defaultServing)) : '',
    protein: initial.protein != null ? String(toRaw(initial.protein, initial.defaultServing)) : '',
    carbs: initial.carbs != null ? String(toRaw(initial.carbs, initial.defaultServing)) : '',
    fat: initial.fat != null ? String(toRaw(initial.fat, initial.defaultServing)) : '',
    fiber: initial.fiber != null ? String(toRaw(initial.fiber, initial.defaultServing)) : '',
  })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const serving = Number(form.serving)
  const norm = (v) => toPer100g(serving, v)

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
          onClick={() => onSave({
            name: form.name.trim(),
            cal: norm(form.cal),
            protein: norm(form.protein),
            carbs: norm(form.carbs),
            fat: norm(form.fat),
            fiber: norm(form.fiber),
            defaultServing: serving,
          })}
          disabled={!form.name || !form.cal || !(serving > 0)}
          className="flex-1 bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold py-2.5 rounded-xl text-sm">
          {saveLabel}
        </button>
      </div>
    </div>
  )
}

function CreateGroupModal({ user, foods, onSave, onClose }) {
  const [name, setName] = useState('')
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')

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

function FoodMacroLine({ f }) {
  if (f.defaultServing > 0 && f.defaultServing !== 100) {
    return (
      <p className="text-zinc-500 text-xs">
        {Math.round(f.cal * f.defaultServing / 100)} kcal ·
        {' '}P {Math.round(f.protein * f.defaultServing / 10) / 10}g ·
        {' '}C {Math.round(f.carbs * f.defaultServing / 10) / 10}g ·
        {' '}F {Math.round(f.fat * f.defaultServing / 10) / 10}g
        {' '}<span className="text-zinc-600">per {f.defaultServing}g</span>
      </p>
    )
  }
  return (
    <p className="text-zinc-500 text-xs">{f.cal} kcal · P {f.protein}g · C {f.carbs}g · F {f.fat}g <span className="text-zinc-600">per 100g</span></p>
  )
}

export default function FoodLibrary() {
  const { user } = useAuth()
  const isAdmin = ADMIN_UID && user?.uid === ADMIN_UID
  const [tab, setTab] = useState('foods')
  const [foods, setFoods] = useState([])
  const [globalFoods, setGlobalFoods] = useState([])
  const [mealGroups, setMealGroups] = useState([])
  const [showAddFood, setShowAddFood] = useState(false)
  const [editingFood, setEditingFood] = useState(null)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [search, setSearch] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [showAddGlobal, setShowAddGlobal] = useState(false)
  const [editingGlobal, setEditingGlobal] = useState(null)
  const [error, setError] = useState(null)

  const showError = (msg) => {
    setError(msg)
    setTimeout(() => setError(null), 4000)
  }

  const load = async () => {
    try {
      const [fs, gs, gls] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'foods')),
        getDocs(collection(db, 'users', user.uid, 'mealGroups')),
        getDocs(collection(db, 'globalLibrary')),
      ])
      setFoods(fs.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)))
      setMealGroups(gs.docs.map(d => ({ id: d.id, ...d.data() })))
      setGlobalFoods(gls.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)))
    } catch (e) {
      showError('Failed to load library')
    }
  }

  useEffect(() => { if (user) load() }, [user])

  const saveFood = async (data) => {
    try {
      const ref = await addDoc(collection(db, 'users', user.uid, 'foods'), data)
      setFoods(f => [...f, { id: ref.id, ...data }].sort((a, b) => a.name.localeCompare(b.name)))
      setShowAddFood(false)
    } catch (e) { showError('Failed to save food') }
  }

  const updateFood = async (id, data) => {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'foods', id), data)
      setFoods(f => f.map(x => x.id === id ? { ...x, ...data } : x).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingFood(null)
    } catch (e) { showError('Failed to update food') }
  }

  const deleteFood = async (id) => {
    if (!window.confirm('Delete this food from your library?')) return
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'foods', id))
      setFoods(f => f.filter(x => x.id !== id))
    } catch (e) { showError('Failed to delete food') }
  }

  const saveGroup = async (data) => {
    try {
      const ref = await addDoc(collection(db, 'users', user.uid, 'mealGroups'), data)
      setMealGroups(g => [...g, { id: ref.id, ...data }])
      setShowGroupModal(false)
    } catch (e) { showError('Failed to save group') }
  }

  const deleteGroup = async (id) => {
    if (!window.confirm('Delete this meal group?')) return
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'mealGroups', id))
      setMealGroups(g => g.filter(x => x.id !== id))
    } catch (e) { showError('Failed to delete group') }
  }

  const saveGlobalFood = async (data) => {
    try {
      const ref = await addDoc(collection(db, 'globalLibrary'), data)
      setGlobalFoods(g => [...g, { id: ref.id, ...data }].sort((a, b) => a.name.localeCompare(b.name)))
      setShowAddGlobal(false)
    } catch (e) { showError('Failed to save global food') }
  }

  const updateGlobalFood = async (id, data) => {
    try {
      await setDoc(doc(db, 'globalLibrary', id), data, { merge: true })
      setGlobalFoods(g => g.map(x => x.id === id ? { ...x, ...data } : x).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingGlobal(null)
    } catch (e) { showError('Failed to update global food') }
  }

  const deleteGlobalFood = async (id) => {
    if (!window.confirm('Remove this food from the global library? All users will lose access.')) return
    try {
      await deleteDoc(doc(db, 'globalLibrary', id))
      setGlobalFoods(g => g.filter(x => x.id !== id))
    } catch (e) { showError('Failed to delete global food') }
  }

  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
  const filteredGlobal = globalFoods.filter(f => f.name.toLowerCase().includes(globalSearch.toLowerCase()))

  const nameCount = foods.reduce((acc, f) => {
    const k = f.name.toLowerCase().trim()
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
  const duplicateCount = Object.values(nameCount).filter(n => n > 1).length

  const tabs = isAdmin
    ? [['foods', 'My Foods'], ['groups', 'Meal Groups'], ['global', 'Global']]
    : [['foods', 'My Foods'], ['groups', 'Meal Groups']]

  return (
    <div className="min-h-full bg-zinc-950 pb-6">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          {error}
        </div>
      )}

      <div className="sticky top-0 z-10 bg-zinc-950 px-4 pt-4 pb-2 border-b border-zinc-900">
        <h1 className="text-white font-bold text-lg mb-3">Library</h1>
        <div className="flex gap-1 bg-zinc-800 rounded-xl p-1">
          {tabs.map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>
              {label}
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
              <button onClick={() => { setShowAddFood(v => !v); setEditingFood(null) }}
                className="bg-green-500 text-black font-bold px-4 rounded-xl text-sm">+ Add</button>
            </div>

            {showAddFood && !editingFood && <FoodForm onSave={saveFood} onCancel={() => setShowAddFood(false)} />}

            {duplicateCount > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-400 flex-shrink-0"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                <p className="text-amber-200 text-xs">
                  {duplicateCount} food name{duplicateCount !== 1 ? 's have' : ' has'} duplicates — review and delete extras below
                </p>
              </div>
            )}

            {globalFoods.length > 0 && !search && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
                <p className="text-blue-300 text-xs font-medium">{globalFoods.length} global food{globalFoods.length !== 1 ? 's' : ''} available — visible in food log search</p>
              </div>
            )}

            {filtered.length === 0 && !showAddFood && (
              <p className="text-zinc-600 text-sm text-center py-12">No foods yet — tap + Add to build your library</p>
            )}

            <div className="space-y-2">
              {filtered.map(f => {
                const isDup = nameCount[f.name.toLowerCase().trim()] > 1
                const isEditing = editingFood?.id === f.id
                return (
                  <div key={f.id} className={`rounded-xl overflow-hidden ${isDup ? 'ring-1 ring-amber-500/30' : ''}`}>
                    {isEditing ? (
                      <FoodForm
                        initial={f}
                        saveLabel="Update"
                        onSave={(data) => updateFood(f.id, data)}
                        onCancel={() => setEditingFood(null)}
                      />
                    ) : (
                      <div className={`px-4 py-3 flex items-center gap-3 ${isDup ? 'bg-amber-500/10' : 'bg-zinc-900'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-medium truncate">{f.name}</p>
                            {isDup && <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider flex-shrink-0">Dup</span>}
                          </div>
                          <FoodMacroLine f={f} />
                        </div>
                        <button onClick={() => { setEditingFood(f); setShowAddFood(false) }} className="text-zinc-600 active:text-green-400 p-1">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                        <button onClick={() => deleteFood(f.id)} className="text-zinc-700 active:text-red-400 p-1">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                      </div>
                    )}
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
                No meal groups yet — Create one to quickly load repeated meals
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

        {tab === 'global' && isAdmin && (
          <>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-blue-400 flex-shrink-0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              <p className="text-blue-300 text-xs font-medium">Admin — Global Library ({globalFoods.length} foods)</p>
            </div>

            <div className="flex gap-2">
              <input placeholder="Search global…" value={globalSearch} onChange={e => setGlobalSearch(e.target.value)}
                className="flex-1 bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
              <button onClick={() => { setShowAddGlobal(v => !v); setEditingGlobal(null) }}
                className="bg-blue-500 text-white font-bold px-4 rounded-xl text-sm">+ Add</button>
            </div>

            {showAddGlobal && !editingGlobal && (
              <FoodForm onSave={saveGlobalFood} onCancel={() => setShowAddGlobal(false)} saveLabel="Add to Global" />
            )}

            {filteredGlobal.length === 0 && !showAddGlobal && (
              <p className="text-zinc-600 text-sm text-center py-12">No global foods yet — tap + Add</p>
            )}

            <div className="space-y-2">
              {filteredGlobal.map(f => {
                const isEditing = editingGlobal?.id === f.id
                return (
                  <div key={f.id} className="rounded-xl overflow-hidden">
                    {isEditing ? (
                      <FoodForm
                        initial={f}
                        saveLabel="Update Global"
                        onSave={(data) => updateGlobalFood(f.id, data)}
                        onCancel={() => setEditingGlobal(null)}
                      />
                    ) : (
                      <div className="bg-zinc-900 px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-medium truncate">{f.name}</p>
                            <span className="text-blue-400 text-[10px] font-bold uppercase tracking-wider flex-shrink-0">Global</span>
                          </div>
                          <FoodMacroLine f={f} />
                        </div>
                        <button onClick={() => { setEditingGlobal(f); setShowAddGlobal(false) }} className="text-zinc-600 active:text-blue-400 p-1">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                        <button onClick={() => deleteGlobalFood(f.id)} className="text-zinc-700 active:text-red-400 p-1">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {showGroupModal && <CreateGroupModal user={user} foods={foods} onSave={saveGroup} onClose={() => setShowGroupModal(false)} />}
    </div>
  )
}
