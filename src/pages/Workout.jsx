import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const toKey = (d) => d.toISOString().slice(0, 10)
const fmt = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

function SetRow({ set, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2">
      <input type="number" inputMode="decimal" placeholder="Reps" value={set.reps}
        onChange={e => onChange({ ...set, reps: e.target.value })}
        className="w-20 bg-zinc-700 text-white rounded-lg px-2 py-1.5 text-sm text-center outline-none" />
      <span className="text-zinc-600 text-xs">×</span>
      <input type="number" inputMode="decimal" placeholder="Weight" value={set.weight}
        onChange={e => onChange({ ...set, weight: e.target.value })}
        className="w-24 bg-zinc-700 text-white rounded-lg px-2 py-1.5 text-sm text-center outline-none" />
      <span className="text-zinc-600 text-xs">lbs</span>
      <button onClick={onRemove} className="text-zinc-700 active:text-red-400 ml-auto">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    </div>
  )
}

function ExerciseCard({ exercise, onChange, onRemove }) {
  const addSet = () => onChange({ ...exercise, sets: [...exercise.sets, { reps: '', weight: '' }] })
  const updateSet = (i, s) => onChange({ ...exercise, sets: exercise.sets.map((x, idx) => idx === i ? s : x) })
  const removeSet = (i) => onChange({ ...exercise, sets: exercise.sets.filter((_, idx) => idx !== i) })

  return (
    <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input value={exercise.name} onChange={e => onChange({ ...exercise, name: e.target.value })}
          className="flex-1 bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-blue-500" />
        <button onClick={onRemove} className="text-zinc-700 active:text-red-400">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1 text-center mb-1">
        <span className="text-zinc-600 text-xs">Reps</span>
        <span className="text-zinc-600 text-xs">Weight</span>
      </div>
      {exercise.sets.map((s, i) => (
        <SetRow key={i} set={s} onChange={ns => updateSet(i, ns)} onRemove={() => removeSet(i)} />
      ))}
      <button onClick={addSet} className="text-blue-400 text-xs font-medium active:text-blue-300">+ Add set</button>
    </div>
  )
}

function TemplateModal({ user, onSelect, onClose }) {
  const [templates, setTemplates] = useState([])
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    getDocs(collection(db, 'users', user.uid, 'workoutTemplates')).then(s =>
      setTemplates(s.docs.map(d => ({ id: d.id, ...d.data() })))
    )
  }, [user])

  const createBlank = async () => {
    if (!newName.trim()) return
    const ref = await addDoc(collection(db, 'users', user.uid, 'workoutTemplates'), {
      name: newName.trim(), exercises: []
    })
    onSelect({ id: ref.id, name: newName.trim(), exercises: [] })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-zinc-900 rounded-t-3xl p-4 max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />
        <p className="text-white font-semibold mb-3">Start Workout</p>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          <button onClick={() => onSelect({ name: 'Workout', exercises: [] })}
            className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-left active:bg-zinc-700">
            <p className="text-white text-sm font-medium">Empty workout</p>
            <p className="text-zinc-500 text-xs">Start from scratch</p>
          </button>

          {templates.map(t => (
            <button key={t.id} onClick={() => onSelect(t)}
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-left active:bg-zinc-700">
              <p className="text-white text-sm font-medium">{t.name}</p>
              <p className="text-zinc-500 text-xs">{t.exercises?.length ?? 0} exercises</p>
            </button>
          ))}
        </div>

        {showNew ? (
          <div className="flex gap-2 mt-3">
            <input placeholder="Template name" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createBlank()}
              className="flex-1 bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none" autoFocus />
            <button onClick={createBlank} className="bg-blue-500 text-white font-bold px-4 rounded-xl text-sm">Save</button>
          </div>
        ) : (
          <button onClick={() => setShowNew(true)} className="mt-3 text-blue-400 text-sm font-medium text-center w-full py-2">
            + Save as new template
          </button>
        )}
      </div>
    </div>
  )
}

export default function Workout() {
  const { user } = useAuth()
  const [date, setDate] = useState(new Date())
  const [workout, setWorkout] = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [newExercise, setNewExercise] = useState('')
  const [showAddEx, setShowAddEx] = useState(false)
  const [newCardio, setNewCardio] = useState({ type: '', duration: '' })
  const [showAddCardio, setShowAddCardio] = useState(false)

  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'logs', toKey(date))
    const unsub = onSnapshot(ref, snap => {
      setWorkout(snap.exists() ? (snap.data().workout ?? null) : null)
    })
    return unsub
  }, [user, date])

  const save = async (updated) => {
    await setDoc(doc(db, 'users', user.uid, 'logs', toKey(date)), { workout: updated }, { merge: true })
  }

  const startWorkout = (template) => {
    const w = {
      done: false,
      name: template.name,
      templateId: template.id ?? null,
      exercises: (template.exercises ?? []).map(e => ({
        name: e.name,
        sets: e.sets ?? [{ reps: '', weight: '' }]
      })),
      cardio: [],
    }
    setWorkout(w)
    save(w)
    setShowTemplates(false)
  }

  const update = (w) => { setWorkout(w); save(w) }

  const updateExercise = (i, ex) => {
    const exercises = workout.exercises.map((e, idx) => idx === i ? ex : e)
    update({ ...workout, exercises })
  }

  const removeExercise = (i) => {
    update({ ...workout, exercises: workout.exercises.filter((_, idx) => idx !== i) })
  }

  const addExercise = () => {
    if (!newExercise.trim()) return
    update({ ...workout, exercises: [...workout.exercises, { name: newExercise.trim(), sets: [{ reps: '', weight: '' }] }] })
    setNewExercise('')
    setShowAddEx(false)
  }

  const addCardio = () => {
    if (!newCardio.type.trim()) return
    update({ ...workout, cardio: [...(workout.cardio ?? []), { ...newCardio, id: crypto.randomUUID() }] })
    setNewCardio({ type: '', duration: '' })
    setShowAddCardio(false)
  }

  const removeCardio = (id) => update({ ...workout, cardio: workout.cardio.filter(c => c.id !== id) })

  const finish = () => {
    const w = { ...workout, done: true }
    update(w)
    if (workout.templateId) {
      setDoc(doc(db, 'users', user.uid, 'workoutTemplates', workout.templateId), {
        name: workout.name,
        exercises: workout.exercises.map(e => ({ name: e.name, sets: e.sets }))
      }, { merge: true })
    }
  }

  const shift = (n) => { const d = new Date(date); d.setDate(d.getDate() + n); setDate(d) }
  const isToday = toKey(date) === toKey(new Date())

  return (
    <div className="min-h-full bg-zinc-950 pb-24">
      <div className="sticky top-0 z-10 bg-zinc-950 px-4 pt-4 pb-2 flex items-center justify-between border-b border-zinc-900">
        <button onClick={() => shift(-1)} className="p-2 text-zinc-400"><svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>
        <div className="text-center">
          <p className="text-white font-semibold text-sm">{fmt(date)}</p>
          {isToday && <p className="text-green-400 text-xs">Today</p>}
        </div>
        <button onClick={() => shift(1)} className="p-2 text-zinc-400"><svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {!workout ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-zinc-600"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" /></svg>
            </div>
            <p className="text-zinc-500 text-sm">No workout logged for this day</p>
            <button onClick={() => setShowTemplates(true)}
              className="bg-blue-500 text-white font-bold px-8 py-3 rounded-2xl text-sm active:scale-95 transition-transform">
              Start Workout
            </button>
          </div>
        ) : (
          <>
            {/* Workout header */}
            <div className="flex items-center gap-3">
              <input value={workout.name} onChange={e => update({ ...workout, name: e.target.value })}
                className="flex-1 bg-zinc-900 text-white text-lg font-bold rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500" />
              {workout.done && <span className="text-green-400 font-semibold text-sm">✓ Done</span>}
            </div>

            {/* Exercises */}
            {workout.exercises.map((ex, i) => (
              <ExerciseCard key={i} exercise={ex} onChange={ex => updateExercise(i, ex)} onRemove={() => removeExercise(i)} />
            ))}

            {/* Add Exercise */}
            {showAddEx ? (
              <div className="flex gap-2">
                <input placeholder="Exercise name" value={newExercise} onChange={e => setNewExercise(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addExercise()}
                  className="flex-1 bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none" autoFocus />
                <button onClick={addExercise} className="bg-blue-500 text-white font-bold px-4 rounded-xl text-sm">Add</button>
              </div>
            ) : (
              <button onClick={() => setShowAddEx(true)}
                className="w-full bg-zinc-900 border border-zinc-800 border-dashed text-zinc-500 font-medium py-3 rounded-2xl text-sm active:text-white">
                + Add Exercise
              </button>
            )}

            {/* Cardio */}
            {(workout.cardio ?? []).length > 0 && (
              <div className="bg-zinc-900 rounded-2xl p-4 space-y-2">
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Cardio / Sports</p>
                {workout.cardio.map(c => (
                  <div key={c.id} className="flex items-center gap-3 bg-zinc-800 rounded-xl px-3 py-2">
                    <span className="flex-1 text-white text-sm">{c.type}</span>
                    <span className="text-zinc-400 text-xs">{c.duration}</span>
                    <button onClick={() => removeCardio(c.id)} className="text-zinc-700 active:text-red-400">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showAddCardio ? (
              <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
                <p className="text-zinc-400 text-xs font-medium">Add Cardio / Sport</p>
                <input placeholder="Type (e.g. Padel, Running…)" value={newCardio.type} onChange={e => setNewCardio(c => ({ ...c, type: e.target.value }))}
                  className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none" autoFocus />
                <input placeholder="Duration (e.g. 1 hour, 30 min)" value={newCardio.duration} onChange={e => setNewCardio(c => ({ ...c, duration: e.target.value }))}
                  className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none" />
                <div className="flex gap-2">
                  <button onClick={() => setShowAddCardio(false)} className="flex-1 bg-zinc-800 text-white py-2.5 rounded-xl text-sm">Cancel</button>
                  <button onClick={addCardio} className="flex-1 bg-blue-500 text-white font-bold py-2.5 rounded-xl text-sm">Add</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddCardio(true)}
                className="w-full bg-zinc-900 border border-zinc-800 border-dashed text-zinc-500 font-medium py-3 rounded-2xl text-sm active:text-white">
                + Add Cardio / Sport
              </button>
            )}

            {!workout.done && (
              <button onClick={finish}
                className="w-full bg-green-500 text-black font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform">
                Finish Workout ✓
              </button>
            )}

            <button onClick={() => { setWorkout(null); save(null) }}
              className="w-full text-zinc-700 text-xs py-2 active:text-red-400">
              Delete workout
            </button>
          </>
        )}
      </div>

      {showTemplates && <TemplateModal user={user} onSelect={startWorkout} onClose={() => setShowTemplates(false)} />}
    </div>
  )
}
