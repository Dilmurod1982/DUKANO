import { create } from 'zustand'
import i18n from '../i18n'

export const useLangStore = create((set) => ({
  lang: localStorage.getItem('dukano-lang') || 'en',
  setLang: (lang) => {
    localStorage.setItem('dukano-lang', lang)
    i18n.changeLanguage(lang)
    set({ lang })
  },
}))