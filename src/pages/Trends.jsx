import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

import { toKey } from '../lib/date'

const PERIODS = [
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
  { label: '15 days', days: 15 },
  { label: '30 days', days: 30 },
]

const dayTotals = (entries) => entries.reduce((s, e) => ({
  cal: s.cal + (e.cal || 0),
  protein: s.protein + (e.protein || 0),
  carbs: s.carbs + (e.carbs || 0),
  fat: s.fat + (e.fat || 0),
}), { cal: 0, protein: 0, carbs: 0, fat: 0 })

function MacroAverages({ logsByDay }) {
  const today = new Date()

  const avgForDays = (days) => {
    const dayTotalsList = []
    for (let i = 0; i < days; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      const log = logsByDay[toKey(d)]
      if (log && log.foodEntries?.length) dayTotalsList.push(dayTotals(log.foodEntries))
    }
    if (dayTotalsList.length === 0) return null
    const sum = dayTotalsList.reduce((s, t) => ({
      cal: s.cal + t.cal, protein: s.protein + t.protein,
      carbs: s.carbs + t.carbs, fat: s.fat + t.fat,
    }), { cal: 0, protein: 0, carbs: 0, fat: 0 })
    const n = dayTotalsList.length
    return {
      cal: Math.round(sum.cal / n),
      protein: Math.round((sum.protein / n) * 10) / 10,
      carbs: Math.round((sum.carbs / n) * 10) / 10,
      fat: Math.round((sum.fat / n) * 10) / 10,
      days: n,
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest px-1">Daily average</p>
      {PERIODS.map(p => {
        const a = avgForDays(p.days)
        return (
          <div key={p.label} className="bg-zinc-900 rounded-2xl p-4">
            <div className="flex justify-between items-baseline mb-2">
              <p className="text-white text-sm font-semibold">Last {p.label}</p>
              {a && <p className="text-zinc-500 text-xs">{a.days} day{a.days !== 1 ? 's' : ''} logged</p>}
            </div>
            {a ? (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-zinc-800 rounded-xl py-2">
                  <p className="text-green-400 text-sm font-bold">{a.cal}</p>
                  <p className="text-zinc-600 text-xs">kcal</p>
                </div>
                <div className="bg-zinc-800 rounded-xl py-2">
                  <p className="text-blue-400 text-sm font-bold">{a.protein}g</p>
                  <p className="text-zinc-600 text-xs">Protein</p>
                </div>
                <div className="bg-zinc-800 rounded-xl py-2">
                  <p className="text-amber-400 text-sm font-bold">{a.carbs}g</p>
                  <p className="text-zinc-600 text-xs">Carbs</p>
                </div>
                <div className="bg-zinc-800 rounded-xl py-2">
                  <p className="text-orange-400 text-sm font-bold">{a.fat}g</p>
                  <p className="text-zinc-600 text-xs">Fat</p>
                </div>
              </div>
            ) : (
              <p className="text-zinc-600 text-sm text-center py-2">No food logged yet</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function WeightChart({ logsByDay }) {
  const [days, setDays] = useState(14)
  const today = new Date()

  const points = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const log = logsByDay[toKey(d)]
    points.push({
      date: d,
      am: log?.metrics?.weightAM ?? null,
      pm: log?.metrics?.weightPM ?? null,
    })
  }

  const allWeights = points.flatMap(p => [p.am, p.pm]).filter(v => v != null)
  const hasData = allWeights.length > 0
  const minW = hasData ? Math.min(...allWeights) - 0.5 : 0
  const maxW = hasData ? Math.max(...allWeights) + 0.5 : 1
  const range = maxW - minW || 1

  const W = 320, H = 160, P = 24
  const xFor = (i) => P + (i / Math.max(points.length - 1, 1)) * (W - P * 2)
  const yFor = (w) => H - P - ((w - minW) / range) * (H - P * 2)

  const buildPath = (key) => {
    let path = ''
    let started = false
    points.forEach((p, i) => {
      if (p[key] == null) return
      const cmd = started ? 'L' : 'M'
      path += `${cmd}${xFor(i).toFixed(1)},${yFor(p[key]).toFixed(1)} `
      started = true
    })
    return path
  }

  const amPath = buildPath('am')
  const pmPath = buildPath('pm')

  const lastAm = [...points].reverse().find(p => p.am != null)?.am
  const lastPm = [...points].reverse().find(p => p.pm != null)?.pm
  const firstAm = points.find(p => p.am != null)?.am
  const trend = lastAm != null && firstAm != null ? lastAm - firstAm : null

  return (
    <div className="bg-zinc-900 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Weight</p>
        <div className="flex gap-1 bg-zinc-800 rounded-lg p-0.5">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${days === d ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {hasData ? (
        <>
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-white text-2xl font-bold">{lastAm ?? lastPm ?? '—'}<span className="text-zinc-500 text-sm ml-1">kg</span></p>
              <p className="text-zinc-500 text-xs">Latest AM</p>
            </div>
            {trend != null && (
              <p className={`text-sm font-medium ${trend > 0 ? 'text-red-400' : trend < 0 ? 'text-green-400' : 'text-zinc-500'}`}>
                {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend).toFixed(1)} kg
              </p>
            )}
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 180 }}>
            <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#27272a" strokeWidth="1" />
            <line x1={P} y1={P} x2={P} y2={H - P} stroke="#27272a" strokeWidth="1" />

            {amPath && <path d={amPath} stroke="#60a5fa" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />}
            {pmPath && <path d={pmPath} stroke="#a78bfa" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />}

            {points.map((p, i) => (
              <g key={i}>
                {p.am != null && <circle cx={xFor(i)} cy={yFor(p.am)} r="2.5" fill="#60a5fa" />}
                {p.pm != null && <circle cx={xFor(i)} cy={yFor(p.pm)} r="2.5" fill="#a78bfa" />}
              </g>
            ))}

            <text x={P - 4} y={yFor(maxW) + 4} fill="#52525b" fontSize="9" textAnchor="end">{maxW.toFixed(1)}</text>
            <text x={P - 4} y={yFor(minW) + 4} fill="#52525b" fontSize="9" textAnchor="end">{minW.toFixed(1)}</text>
          </svg>

          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <span className="text-zinc-400 text-xs">AM</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <span className="text-zinc-400 text-xs">PM</span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-zinc-600 text-sm text-center py-8">No weight logged yet — add it on the Daily tab</p>
      )}
    </div>
  )
}

export default function Trends() {
  const { user } = useAuth()
  const [logsByDay, setLogsByDay] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getDocs(collection(db, 'users', user.uid, 'logs')).then(snap => {
      const map = {}
      snap.docs.forEach(d => { map[d.id] = d.data() })
      setLogsByDay(map)
      setLoading(false)
    })
  }, [user])

  return (
    <div className="min-h-full bg-zinc-950 pb-6">
      <div className="sticky top-0 z-10 bg-zinc-950 px-4 pt-4 pb-3 border-b border-zinc-900">
        <h1 className="text-white font-bold text-lg">Trends</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {loading ? (
          <p className="text-zinc-600 text-sm text-center py-12">Loading…</p>
        ) : (
          <>
            <WeightChart logsByDay={logsByDay} />
            <MacroAverages logsByDay={logsByDay} />
          </>
        )}
      </div>
    </div>
  )
}
