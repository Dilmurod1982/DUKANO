// src/store/authStore.js
import { create } from 'zustand'
import { auth, db } from '../firebase/config'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { logAction } from '../lib/logger'

const SUPER_ADMIN_EMAIL = 'dilik@mail.ru'

export const useAuthStore = create((set, get) => ({
  user: null,
  role: null,
  loading: true,        // глобальная инициализация (init)
  isLoggingIn: false,   // состояние кнопки логина

  init: () => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        set({ user: null, role: null, loading: false })
        return
      }
      let role = null
      if (firebaseUser.email === SUPER_ADMIN_EMAIL) {
        role = 'superadmin'
      } else {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.email))
          if (snap.exists()) role = snap.data().role
        } catch {
          // игнорируем — роль останется null
        }
      }
      set({ user: firebaseUser, role: role || 'user', loading: false })
    })
  },

  login: async (email, password) => {
    set({ isLoggingIn: true })
    try {
      await signInWithEmailAndPassword(auth, email, password)

      // сохраняем для возврата сессии после создания пользователя
      sessionStorage.setItem('adminEmail', email)
      sessionStorage.setItem('adminPassword', password)

      // лог входа (после успешного signIn — request.auth уже есть)
      await logAction({
        action: 'login',
        module: 'auth',
        actorEmail: email,
        actorRole: email === SUPER_ADMIN_EMAIL ? 'superadmin' : 'unknown',
        description: `Вход в систему: ${email}`,
      })
    } finally {
      // сбрасываем всегда — и при успехе, и при ошибке
      set({ isLoggingIn: false })
    }
  },

  logout: async () => {
    const { user, role } = get()
    // лог ДО signOut, иначе правило isSignedIn() отклонит запись
    if (user?.email) {
      await logAction({
        action: 'logout',
        module: 'auth',
        actorEmail: user.email,
        actorRole: role || 'unknown',
        description: `Выход из системы: ${user.email}`,
      })
    }
    await signOut(auth)
    sessionStorage.removeItem('adminEmail')
    sessionStorage.removeItem('adminPassword')
    set({ user: null, role: null })
  },
}))