import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '../firebase'

export async function isAdmin(uid) {
  if (!uid) return false
  try {
    const snap = await getDoc(doc(firestore, 'admins', uid))
    return snap.exists()
  } catch (error) {
    console.error('Ошибка проверки прав администратора:', error)
    return false
  }
}
