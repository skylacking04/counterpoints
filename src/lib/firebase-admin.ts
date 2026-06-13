import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = process.env.GCLOUD_PROJECT
  ?? process.env.GOOGLE_CLOUD_PROJECT
  ?? 'wandern-project-startup'

function getAdmin() {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
}

// Lazy singleton — safe to import at module level in Next.js API routes
export function getDb() {
  return getFirestore(getAdmin())
}
