import { supabase } from '../lib/supabase'

export type DriverSession = {sessionId: string, startedAt: string, fingerprintCount: number}

type FingerprintSessionRow = {session_id: string, timestamp: string}

export async function getDriverSessions(driverId: string,): Promise<DriverSession[]> {
  const { data, error } = await supabase
    .from('fingerprints')
    .select('session_id, timestamp')
    .eq('driver_id', driverId)
    .order('timestamp', { ascending: false })

  if (error) {
    throw error
  }

  const sessions = new Map<string, DriverSession>()

  for (const row of (data ?? []) as FingerprintSessionRow[]) {
    const existing = sessions.get(row.session_id)

    if (existing) {
      existing.fingerprintCount += 1
    } else {
      sessions.set(row.session_id, {
        sessionId: row.session_id,
        startedAt: row.timestamp,
        fingerprintCount: 1,
      })
    }
  }

  return Array.from(sessions.values())
}

export type SessionFingerprint = {sequenceNumber: number, timestamp: string, hash: string, chainHash: string}

type SessionFingerprintRow = {sequence_number: number, timestamp: string, hash: string, chain_hash: string}

export async function getSessionFingerprints(sessionId: string,): Promise<SessionFingerprint[]> {
  const { data, error } = await supabase
    .from('fingerprints')
    .select(
      'sequence_number, timestamp, hash, chain_hash',
    )
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: true })

  if (error) {
    throw error
  }

  return ((data ?? []) as SessionFingerprintRow[]).map(
    (row) => ({
      sequenceNumber: row.sequence_number,
      timestamp: row.timestamp,
      hash: row.hash,
      chainHash: row.chain_hash,
    }),
  )
}