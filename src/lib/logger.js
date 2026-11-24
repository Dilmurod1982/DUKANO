// src/lib/logger.js
import { db } from '../firebase/config'
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'

export const ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  VIEW: 'view',
  ERROR: 'error',
}

export const MODULES = {
  AUTH: 'auth',
  USERS: 'users',
  PRODUCTS: 'products',
  INVENTORY: 'inventory',
  TRANSACTIONS: 'transactions',
}

/**
 * Универсальная запись аудита.
 * Никогда не бросает исключение наружу — логирование не должно ломать бизнес-операцию.
 */
export async function logAction({
  action,
  module,
  actorEmail,
  actorRole,
  targetId = null,
  targetType = null,
  description = '',
  metadata = {},
  status = 'success',
}) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      action,
      module,
      actorEmail: actorEmail || 'unknown',
      actorRole: actorRole || 'unknown',
      targetId,
      targetType,
      description,
      metadata,
      status,
      createdAt: new Date().toISOString(),
      createdAtTs: serverTimestamp(),
    })
  } catch (e) {
    // Не ломаем вызывающий код, просто пишем в консоль
    console.error('[audit] failed to write log', e)
  }
}