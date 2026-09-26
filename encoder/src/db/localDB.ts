import Dexie, {type EntityTable, type InsertType,} from 'dexie'
import type {Fingerprint} from '../services/fingerprint'

export type PendingFingerprint = Fingerprint & {id: number}

const database = new Dexie('dashcam-local') as Dexie & {
    pendingFingerprints: EntityTable<PendingFingerprint, 'id'>
}

database.version(1).stores({pendingFingerprints: '++id, sessionId, sequenceNumber, timestamp',})

export{database}