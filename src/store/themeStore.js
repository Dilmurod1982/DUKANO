import { create } from 'zustand'

const getInitialTheme = () => {
  const saved = localStorage.getItem('dukano-theme')
  if (saved) return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useThemeStore = create((set) => ({
  theme: getInitialTheme(),
  toggle: () => set((state) => {
    const next = state.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('dukano-theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    return { theme: next }
  }),
  init: () => {
    const theme = getInitialTheme()
    document.documentElement.classList.toggle('dark', theme === 'dark')
    set({ theme })
  },
}))