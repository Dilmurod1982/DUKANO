import { getFunctions, httpsCallable } from 'firebase/functions'
import app from '../firebase/config'

const functions = getFunctions(app, 'us-central1')

export const createUserCallable = httpsCallable(functions, 'createUser')