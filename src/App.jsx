import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { auth, rtdb } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { isAdmin } from './utils/admin'
import { onValue, onDisconnect, ref, set as rtdbSet } from 'firebase/database'
import HomePage from './pages/HomePage'
import TablePage from './pages/TablePage'
import AdminPage from './pages/AdminPage'

function Header({ user, isAdmin, onLogout, onLogin, authError, username, password, setUsername, setPassword }) {
  const location = useLocation()

  return (
    <header className="app-header">
      <div>
        <p className="muted">Школьный рейтинг</p>
        <h1>Лидер-9: рейтинг классов</h1>
      </div>
      <div className="nav-links">
        <Link className={location.pathname === '/' ? 'active' : ''} to="/">
          Лучший класс
        </Link>
        <Link className={location.pathname === '/table' ? 'active' : ''} to="/table">
          Полная таблица
        </Link>
        <Link className={location.pathname === '/admin' ? 'active' : ''} to="/admin">
          Импорт / Админ
        </Link>
      </div>
      <div className="auth-block">
        {user ? (
          <div className="auth-info">
            <div className="muted text-small">{isAdmin ? 'Администратор' : 'Пользователь'}</div>
            <div className="auth-user">{user.email?.split('@')[0] ?? 'Гость'}</div>
            <button className="secondary" onClick={onLogout}>
              Выйти
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={onLogin}>
            <div className="input-group">
              <label>Логин</label>
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin1 или admin2"
              />
            </div>
            <div className="input-group">
              <label>Пароль</label>
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit">Войти</button>
            {authError && <p className="error">{authError}</p>}
            <p className="muted text-small">Логин отправляется как имя@school.local</p>
          </form>
        )}
      </div>
    </header>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authError, setAuthError] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [presence, setPresence] = useState({})
  const [presenceWriter, setPresenceWriter] = useState(() => () => {})

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      setIsCheckingAuth(false)
      if (currentUser) {
        const hasAdminAccess = await isAdmin(currentUser.uid, currentUser.email)
        setIsAdmin(hasAdminAccess)
      } else {
        setIsAdmin(false)
      }
    })

    return () => unsub()
  }, [])

  useEffect(() => {
    const presenceRef = ref(rtdb, 'presence')
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      setPresence(snapshot.val() ?? {})
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setPresenceWriter(() => () => {})
      return undefined
    }

    const userRef = ref(rtdb, `presence/${user.uid}`)
    let extraState = {}

    const pushPresence = (patch = {}) => {
      extraState = { ...extraState, ...patch }
      return rtdbSet(userRef, {
        uid: user.uid,
        email: user.email,
        name: user.email?.split('@')[0],
        lastActive: Date.now(),
        status: 'online',
        ...extraState,
      })
    }

    pushPresence()
    const heartbeat = setInterval(() => pushPresence(), 20000)
    const disconnect = onDisconnect(userRef)
    disconnect.remove()
    setPresenceWriter(() => pushPresence)

    return () => {
      clearInterval(heartbeat)
      disconnect.cancel()
      rtdbSet(userRef, {
        uid: user.uid,
        email: user.email,
        name: user.email?.split('@')[0],
        status: 'offline',
        lastActive: Date.now(),
      })
    }
  }, [user])

  const handleLogin = async (event) => {
    event.preventDefault()
    setAuthError('')
    try {
      const normalizedUsername = username.trim().replace(/\s+/g, '').toLowerCase()
      const normalizedPassword = password.trim()

      if (!normalizedUsername || !normalizedPassword) {
        setAuthError('Введите логин и пароль администратора без пробелов.')
        return
      }

      const email = `${normalizedUsername}@school.local`
      await signInWithEmailAndPassword(auth, email, normalizedPassword)
      setUsername('')
      setPassword('')
    } catch (err) {
      setAuthError('Не удалось войти. Проверьте логин и пароль администратора.')
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
  }

  const sharedPresence = useMemo(() => ({ list: presence, writer: presenceWriter }), [presence, presenceWriter])

  return (
    <div className="app">
      <Header
        user={user}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        onLogin={handleLogin}
        authError={authError}
        username={username}
        password={password}
        setUsername={setUsername}
        setPassword={setPassword}
      />

      {isCheckingAuth && <p className="muted">Проверяем сессию...</p>}

      <main className="page-wrapper">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                presence={sharedPresence.list}
                isAdmin={isAdmin}
                currentUserId={user?.uid}
              />
            }
          />
          <Route
            path="/table"
            element={
              <TablePage
                isAdmin={isAdmin}
                presence={sharedPresence.list}
              />
            }
          />
          <Route
            path="/admin"
            element={
              <AdminPage
                user={user}
                isAdmin={isAdmin}
                presence={sharedPresence.list}
                presenceWriter={sharedPresence.writer}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  )
}

export function AppWithRouter() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}
