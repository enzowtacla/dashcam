import Dexie, {type EntityTable} from 'dexie'

import type {Fingerprint} from '../services/fingerprint'

export type PendingFingerprint =
  Fingerprint & {id?: number, queuedAt: string}

const database =
  new Dexie('dashcam-local') as Dexie & {
    pendingFingerprints:
      EntityTable<
        PendingFingerprint,
        'id'
      >
  }

database.version(5).stores({
  pendingFingerprints:
    '++id, driverId, sessionId, sequenceNumber, timestamp, queuedAt',
})

export { database }