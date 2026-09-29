import Dexie, {
  type EntityTable,
} from 'dexie'

import type { Fingerprint } from '../services/fingerprint'

export type PendingFingerprint = Fingerprint & {
  id?: number
  queuedAt: string
}

const database = new Dexie('dashcam-local') as Dexie & {
  pendingFingerprints: EntityTable<
    PendingFingerprint,
    'id'
  >
}

database.version(1).stores({pendingFingerprints: '++id, sessionId, sequenceNumber, timestamp'})

database.version(2).stores({pendingFingerprints: '++id, sessionId, sequenceNumber, timestamp, queuedAt'})

database.version(3).stores({pendingFingerprints: '++id, driverId, sessionId, sequenceNumber, timestamp, queuedAt'})

database.version(4).stores({pendingFingerprints: '++id, driverId, sessionId, sequenceNumber, timestamp, queuedAt'})

database.version(5).stores({pendingFingerprints: '++id, driverId, sessionId, sequenceNumber, timestamp, queuedAt'})

export { database }