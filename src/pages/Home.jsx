import { useState, useEffect } from 'react'
import { doc, onSnapshot, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const fmt = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const toKey = (d) => d.toISOString().slice(0, 10)
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

function MacroBar({ label, value, goal, color }) {
  const pct = goal > 0 ? clamp((value / goal) * 100, 0, 100) : 0
  const over = goal > 0 && value > goal
  return (
    <div className="flex items-center gap-3">
      <span className="text-zinc-400 text-xs w-6">{label}</span>
      <div className="flex-1 bg-zinc-800 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${over ? 'bg-red-500' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-zinc-300 w-16 text-right">{Math.round(value)}g / {goal}g</span>
    </div>
  )
}

export default function Home() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [date, setDate] = useState(new Date())
  const [log, setLog] = useState(null)
  const [settings, setSettings] = useState({ calorieGoal: 2500, proteinGoal: 150, carbsGoal: 300, fatGoal: 80 })

  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'users', user.uid, 'settings', 'goals')).then(snap => {
      if (snap.exists()) setSettings(s => ({ ...s, ...snap.data() }))
    })
  }, [user])

  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'logs', toKey(date))
    const unsub = onSnapshot(ref, snap => setLog(snap.exists() ? snap.data() : null))
    return unsub
  }, [user, date])

  const entries = log?.foodEntries ?? []
  const totalCal = entries.reduce((s, e) => s + (e.cal || 0), 0)
  const totalP = entries.reduce((s, e) => s + (e.protein || 0), 0)
  const totalC = entries.reduce((s, e) => s + (e.carbs || 0), 0)
  const totalF = entries.reduce((s, e) => s + (e.fat || 0), 0)
  const remaining = settings.calorieGoal - totalCal
  const calPct = clamp((totalCal / settings.calorieGoal) * 100, 0, 100)
  const workout = log?.workout
  const metrics = log?.metrics ?? {}

  const shift = (n) => {
    const d = new Date(date)
    d.setDate(d.getDate() + n)
    setDate(d)
  }

  const isToday = toKey(date) === toKey(new Date())

  return (
    <div className="min-h-full bg-zinc-950 pb-4">
      {/* Header */}
      <div className="bg-zinc-950 sticky top-0 z-10 px-4 pt-4 pb-2 flex items-center justify-between border-b border-zinc-900">
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

      <div className="px-4 pt-4 space-y-3">
        {/* Calories Card */}
        <div
          className="bg-zinc-900 rounded-2xl p-4 cursor-pointer active:opacity-80"
          onClick={() => navigate('/food')}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Calories</span>
            <span className="text-zinc-500 text-xs">{settings.calorieGoal} goal</span>
          </div>
          <div className="flex items-end gap-2 mb-3">
            <span className={`text-4xl font-bold ${remaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
              {Math.abs(Math.round(remaining))}
            </span>
            <span className="text-zinc-400 text-sm mb-1">{remaining < 0 ? 'over' : 'remaining'}</span>
            <span className="text-zinc-600 text-sm mb-1 ml-auto">{Math.round(totalCal)} eaten</span>
          </div>
          <div className="bg-zinc-800 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${totalCal > settings.calorieGoal ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${calPct}%` }}
            />
          </div>
        </div>

        {/* Macros Card */}
        <div className="bg-zinc-900 rounded-2xl p-4 space-y-3" onClick={() => navigate('/food')}>
          <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Macros</span>
          <MacroBar label="P" value={totalP} goal={settings.proteinGoal} color="bg-blue-500" />
          <MacroBar label="C" value={totalC} goal={settings.carbsGoal} color="bg-amber-500" />
          <MacroBar label="F" value={totalF} goal={settings.fatGoal} color="bg-orange-500" />
        </div>

        {/* Workout Card */}
        <div
          className="bg-zinc-900 rounded-2xl p-4 flex items-center gap-3 cursor-pointer active:opacity-80"
          onClick={() => navigate('/workout')}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${workout?.done ? 'bg-blue-500/20' : 'bg-zinc-800'}`}>
            <svg viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 ${workout?.done ? 'text-blue-400' : 'text-zinc-500'}`}>
              <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">
              {workout?.done ? (workout.name || 'Workout done') : 'No workout logged'}
            </p>
            {workout?.done && workout.exercises?.length > 0 && (
              <p className="text-zinc-500 text-xs truncate">
                {workout.exercises.map(e => e.name).join(' · ')}
              </p>
            )}
          </div>
          {workout?.done && <span className="text-green-400 text-lg">✓</span>}
        </div>

        {/* Steps + Weight Row */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="bg-zinc-900 rounded-2xl p-4 cursor-pointer active:opacity-80"
            onClick={() => navigate('/daily')}
          >
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest mb-2">Steps</p>
            <p className="text-2xl font-bold text-orange-400">
              {metrics.steps ? metrics.steps.toLocaleString() : '—'}
            </p>
            {metrics.miles > 0 && <p className="text-zinc-500 text-xs mt-0.5">{metrics.miles} mi</p>}
          </div>
          <div
            className="bg-zinc-900 rounded-2xl p-4 cursor-pointer active:opacity-80"
            onClick={() => navigate('/daily')}
          >
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest mb-2">Weight</p>
            <p className="text-2xl font-bold text-white">
              {metrics.weightAM ? `${metrics.weightAM}` : '—'}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">
              {metrics.weightAM ? `AM · ${metrics.weightPM ? `PM ${metrics.weightPM}` : 'no PM'}` : 'not logged'}
            </p>
          </div>
        </div>

        {/* Supplements Card */}
        <div
          className="bg-zinc-900 rounded-2xl p-4 flex items-center gap-3 cursor-pointer active:opacity-80"
          onClick={() => navigate('/daily')}
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <span className="text-purple-400 text-lg">💊</span>
          </div>
          <div>
            <p className="text-white text-sm font-medium">Supplements</p>
            <p className="text-zinc-500 text-xs">
              {(metrics.supplementsDone?.length ?? 0)} taken today
            </p>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={logout}
          className="w-full text-zinc-600 text-xs py-2 active:text-zinc-400"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
