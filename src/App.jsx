import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { auth, firestore, rtdb } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { onDisconnect, onValue, ref, set as rtdbSet } from 'firebase/database'
import RankingTable from './components/RankingTable'
import PresenceList from './components/PresenceList'
import HistoryPanel from './components/HistoryPanel'
import ImportDialog from './components/ImportDialog'

export default function App() {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authError, setAuthError] = useState('')
  const [columns, setColumns] = useState([])
  const [rows, setRows] = useState([])
  const [history, setHistory] = useState([])
  const [presence, setPresence] = useState({})
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const userDisplayName = useMemo(() => user?.email?.split('@')[0] ?? 'Гость', [user])

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
    const metaRef = doc(firestore, 'meta', 'columns')
    const rowsQuery = query(collection(firestore, 'rows'), orderBy('name'))
    const unsubMeta = onSnapshot(metaRef, (snapshot) => {
      setColumns(snapshot.data()?.columns ?? [])
    })
    const unsubRows = onSnapshot(rowsQuery, (snapshot) => {
      const mapped = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      setRows(mapped)
    })

    return () => {
      unsubMeta()
      unsubRows()
    }
  }, [])

  useEffect(() => {
    const presenceRef = ref(rtdb, 'presence')
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      setPresence(snapshot.val() ?? {})
    })

    return () => unsubscribe()
  }, [])

  const [presenceWriter, setPresenceWriter] = useState(() => () => {})

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

  useEffect(() => {
    if (!isAdmin) {
      setHistory([])
      return undefined
    }

    const historyQuery = query(collection(firestore, 'history'), orderBy('ts', 'desc'), limit(100))
    const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
      const mapped = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          ts: data.ts?.toDate ? data.ts.toDate().toLocaleString('ru-RU') : '—',
          user: data.user ?? 'Неизвестно',
          rowId: data.rowId,
          col: data.col,
          before: data.before ?? '',
          after: data.after ?? '',
        }
      })
      setHistory(mapped)
    })

    return () => unsubscribe()
  }, [isAdmin])

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

  const handleEditCell = useCallback(
    async (rowId, col, value) => {
      if (!isAdmin) return
      const targetRow = rows.find((row) => row.id === rowId)
      const before = targetRow?.data?.[col] ?? ''
      await updateDoc(doc(firestore, 'rows', rowId), {
        [`data.${col}`]: value,
      })

      await addDoc(collection(firestore, 'history'), {
        ts: serverTimestamp(),
        user: user?.email ?? 'неизвестно',
        rowId,
        col,
        before,
        after: value,
      })
      presenceWriter({ editingRow: rowId })
    },
    [isAdmin, rows, user, presenceWriter]
  )

  const handleEditingRowChange = useCallback(
    (rowId) => {
      if (!user) return
      presenceWriter({ editingRow: rowId || null })
    },
    [presenceWriter, user]
  )

  const handleImport = useCallback(
    async ({ columns: newColumns, rows: importedRows }) => {
      if (!isAdmin) return
      const batch = writeBatch(firestore)
      const metaRef = doc(firestore, 'meta', 'columns')
      batch.set(metaRef, { columns: newColumns })

      const existing = await getDocs(collection(firestore, 'rows'))
      existing.forEach((docSnap) => batch.delete(docSnap.ref))

      importedRows.forEach((row) => {
        const rowRef = doc(firestore, 'rows', row.id)
        batch.set(rowRef, {
          name: row.name,
          data: row.data,
        })
      })

      await batch.commit()
    },
    [isAdmin]
  )

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="muted">Школьный рейтинг</p>
          <h1>Лидер-9: рейтинг учеников</h1>
        </div>
        <div className="auth-block">
          {user ? (
            <>
              <div className="muted text-small">{isAdmin ? 'Администратор' : 'Пользователь'}</div>
              <div className="auth-user">{userDisplayName}</div>
              <button className="secondary" onClick={handleLogout}>
                Выйти
              </button>
            </>
          ) : (
            <form className="login-form" onSubmit={handleLogin}>
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

      {isCheckingAuth && <p className="muted">Проверяем сессию...</p>}

      <main className="grid">
        <section className="grid-main">
          <RankingTable
            columns={columns}
            rows={rows}
            isAdmin={isAdmin}
            onEditCell={handleEditCell}
            onEditingRowChange={handleEditingRowChange}
          />
        </section>
        <aside className="grid-side">
          <PresenceList presence={presence} currentUserId={user?.uid} />
          {isAdmin && <ImportDialog onImport={handleImport} />}
          {isAdmin && <HistoryPanel history={history} />}
        </aside>
      </main>
    </div>
  )
}
