const functions = require('firebase-functions')
const admin = require('firebase-admin')
admin.initializeApp()

const db = admin.firestore()

exports.createUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Требуется вход')
  }

  const callerEmail = context.auth.token.email
  let callerRole = 'user'
  if (callerEmail === 'dilik@mail.ru') {
    callerRole = 'superadmin'
  } else {
    const callerDoc = await db.collection('users').doc(callerEmail).get()
    if (callerDoc.exists) callerRole = callerDoc.data().role
  }

  const targetRole = data.role
  const canCreate =
    (callerRole === 'superadmin' && targetRole === 'admin') ||
    (callerRole === 'admin' && targetRole === 'user')
  if (!canCreate) {
    throw new functions.https.HttpsError('permission-denied', 'Недостаточно прав')
  }

  const userRecord = await admin.auth().createUser({
    email: data.email,
    password: data.password,
    displayName: `${data.lastName} ${data.firstName}`,
  })

  await db.collection('users').doc(data.email).set({
    uid: userRecord.uid,
    email: data.email,
    role: targetRole,
    lastName: data.lastName,
    firstName: data.firstName,
    middleName: data.middleName || '',
    birthDate: data.birthDate,
    passportSeries: data.passportSeries,
    passportNumber: data.passportNumber,
    pinfl: data.pinfl,
    createdBy: callerEmail,
    createdAt: new Date().toISOString(),
  })

  await db.collection('auditLogs').add({
    action: 'create_user',
    actorEmail: callerEmail,
    actorRole: callerRole,
    targetEmail: data.email,
    targetRole,
    timestamp: new Date().toISOString(),
  })

  return { uid: userRecord.uid, email: data.email, role: targetRole }
})