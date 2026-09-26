import { database } from '../db/localDB'
import type { Fingerprint } from './fingerprint'
import { sendFingerprint } from './fingerprint'

export async function addToOfflineQueue(
  fingerprint: Fingerprint,
): Promise<void> {
  await database.pendingFingerprints.add(fingerprint)

  console.log('Fingerprint saved locally:', fingerprint)
}

export async function getPendingFingerprints() {
  return database.pendingFingerprints
    .orderBy('id')
    .toArray()
}

export async function removeFromOfflineQueue(
  id: number,
): Promise<void> {
  await database.pendingFingerprints.delete(id)
}

export async function getPendingCount(): Promise<number> {
  return database.pendingFingerprints.count()
}

export async function flushOfflineQueue(): Promise<void> {
  const pendingFingerprints = await getPendingFingerprints()

  for (const fingerprint of pendingFingerprints) {
    if (fingerprint.id === undefined) {
      continue
    }

    try {
      await sendFingerprint(fingerprint)

      await removeFromOfflineQueue(fingerprint.id)

      console.log(
        'Pending fingerprint sent:',
        fingerprint.sequenceNumber,
      )
    } catch (error) {
      console.error(
        'Could not send pending fingerprint:',
        error,
      )

      break
    }
  }
}