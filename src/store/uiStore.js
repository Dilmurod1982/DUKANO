import { create } from 'zustand'

export const useUIStore = create((set) => ({
  sidebarOpen: false,          // мобильный drawer
  sidebarCollapsed: false,     // десктоп: свернуть до иконок

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  toggleCollapse: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) useUIStore.getState().closeSidebar()
  })
}