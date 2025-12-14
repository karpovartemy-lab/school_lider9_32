import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import { auth, firestore, rtdb } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { onDisconnect, onValue, ref, set as rtdbSet } from 'firebase/database'
import HomePage from './pages/HomePage'
import TablePage from './pages/TablePage'
import AdminPage from './pages/AdminPage'
import PresenceList from './components/PresenceList'
import { WorkbookProvider } from './context/WorkbookContext'

function AuthStatus({ user, isAdmin, onLogout, onLogin, authError, username, password, setUsername, setPassword }) {
  return (
    <div className="auth-block">
      {user ? (
        <>
          <div className="muted text-small">{isAdmin ? 'Администратор' : 'Пользователь'}</div>
          <div className="auth-user">{user.email?.split('@')[0] ?? 'Пользователь'}</div>
          <button className="secondary" onClick={onLogout}>
            Выйти
          </button>
        </>
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
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authError, setAuthError] = useState('')
  const [presence, setPresence] = useState({})
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const presenceWriterRef = useRef(() => {})

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      setIsCheckingAuth(false)
      if (currentUser) {
        const adminDoc = await getDoc(doc(firestore, 'admins', currentUser.uid))
        setIsAdmin(adminDoc.exists())
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
      presenceWriterRef.current = () => {}
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
    presenceWriterRef.current = pushPresence

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
      const email = `${username}@school.local`
      await signInWithEmailAndPassword(auth, email, password)
      setUsername('')
      setPassword('')
    } catch (err) {
      setAuthError('Не удалось войти. Проверьте логин и пароль администратора.')
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
  }

  const pushHistory = useCallback(
    async (items) => {
      if (!user || !isAdmin || !items.length) return

      const historyBatch = writeBatch(firestore)
      const historyCollection = collection(firestore, 'history')

      items.slice(0, 25).forEach((item) => {
        const refDoc = doc(historyCollection)
        historyBatch.set(refDoc, {
          ts: serverTimestamp(),
          user: user?.email ?? 'неизвестно',
          ...item,
        })
      })

      await historyBatch.commit()
    },
    [isAdmin, user]
  )

  const headerContent = useMemo(
    () => (
      <header className="app-header">
        <div>
          <p className="muted">Школьный рейтинг</p>
          <h1>Лидер-9: рейтинг учеников</h1>
        </div>
        <AuthStatus
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
      </header>
    ),
    [authError, handleLogout, handleLogin, isAdmin, password, user, username]
  )

  return (
    <BrowserRouter>
      <WorkbookProvider
        user={user}
        isAdmin={isAdmin}
        presenceWriterRef={presenceWriterRef}
        pushHistory={pushHistory}
        presence={presence}
      >
        <div className="app">
          {headerContent}

          <nav className="top-nav">
            <NavLink to="/" end>
              Победители
            </NavLink>
            <NavLink to="/table">Полная таблица рейтинга</NavLink>
            <NavLink to="/admin">Импорт и настройки</NavLink>
          </nav>

          {isCheckingAuth && <p className="muted">Проверяем сессию...</p>}

          <main className="layout-grid">
            <section className="layout-main">
              <Routes>
                <Route path="/" element={<HomePage isAdmin={isAdmin} />} />
                <Route path="/table" element={<TablePage isAdmin={isAdmin} />} />
                <Route path="/admin" element={<AdminPage isAdmin={isAdmin} />} />
              </Routes>
            </section>
            <aside className="layout-side">
              <PresenceList presence={presence} currentUserId={user?.uid} />
            </aside>
          </main>
        </div>
      </WorkbookProvider>
    </BrowserRouter>
  )
}
