import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '../firebase'

const buildCandidates = (uid, email) => {
  const candidates = []

  if (uid) {
    candidates.push(uid)
  }

  if (email) {
    const normalizedEmail = email.trim().toLowerCase()
    const localPart = normalizedEmail.split('@')[0]
    candidates.push(normalizedEmail, localPart)
  }

  return Array.from(new Set(candidates)).filter(Boolean)
}

export async function isAdmin(uid, email) {
  const idsToCheck = buildCandidates(uid, email)
  if (idsToCheck.length === 0) return false

  try {
    const checks = await Promise.all(idsToCheck.map((id) => getDoc(doc(firestore, 'admins', id))))
    return checks.some((snap) => snap.exists())
  } catch (error) {
    console.error('Ошибка проверки прав администратора:', error)
    return false
  }
}
