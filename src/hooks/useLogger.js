// src/hooks/useLogger.js
import { useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { logAction } from '../lib/logger'

export function useLogger() {
  const { user, role } = useAuthStore()

  const log = useCallback(
    (params) =>
      logAction({
        ...params,
        actorEmail: user?.email || 'unknown',
        actorRole: role || 'unknown',
      }),
    [user?.email, role]
  )

  const logCreate = useCallback(
    (module, description, targetId = null, metadata = {}) =>
      log({ action: 'create', module, description, targetId, metadata }),
    [log]
  )

  const logUpdate = useCallback(
    (module, description, targetId = null, metadata = {}) =>
      log({ action: 'update', module, description, targetId, metadata }),
    [log]
  )

  const logDelete = useCallback(
    (module, description, targetId = null, metadata = {}) =>
      log({ action: 'delete', module, description, targetId, metadata }),
    [log]
  )

  const logError = useCallback(
    (module, description, targetId = null, metadata = {}) =>
      log({
        action: 'error',
        module,
        description,
        targetId,
        metadata,
        status: 'error',
      }),
    [log]
  )

  const logLogin = useCallback(
    (description = 'User logged in', metadata = {}) =>
      log({ action: 'login', module: 'auth', description, metadata }),
    [log]
  )

  const logLogout = useCallback(
    (description = 'User logged out', metadata = {}) =>
      log({ action: 'logout', module: 'auth', description, metadata }),
    [log]
  )

  return { log, logCreate, logUpdate, logDelete, logError, logLogin, logLogout }
}