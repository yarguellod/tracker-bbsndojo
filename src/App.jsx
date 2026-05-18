import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import Home from './pages/Home'
import FoodLog from './pages/FoodLog'
import FoodLibrary from './pages/FoodLibrary'
import Workout from './pages/Workout'
import Daily from './pages/Daily'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (user === undefined) return (
    <div className="flex items-center justify-center h-screen bg-zinc-950">
      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Home />} />
        <Route path="food" element={<FoodLog />} />
        <Route path="workout" element={<Workout />} />
        <Route path="daily" element={<Daily />} />
        <Route path="library" element={<FoodLibrary />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
