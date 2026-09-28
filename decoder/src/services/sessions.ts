import {supabase} from '../lib/supabase'

export type DriverSession = {sessionId: string, startedAt: string, frameCount: number}

type FingerprintSessionRow = {session_id: string, timestamp: string}

export async function getDriverSessions(driverId: string,): Promise<DriverSession[]> {
  const {data, error} = await supabase
    .from('fingerprints')
    .select('session_id, timestamp')
    .eq('driver_id', driverId)
    .not('frame_path', 'is', null)
    .order('timestamp', {ascending: false})

  if (error) {
    throw error
  }

  const sessions = new Map<string, DriverSession>()

  for (const row of (data ?? []) as FingerprintSessionRow[]) {
    const existing = sessions.get(row.session_id)

    if (existing) {
      existing.frameCount += 1
    } 
    else {
      sessions.set(row.session_id, {
        sessionId: row.session_id,
        startedAt: row.timestamp,
        frameCount: 1,
      })
    }
  }

  return Array.from(sessions.values())
}

export type SessionFrame = {sequenceNumber: number, timestamp: string, hash: string, framePath: string}

type SessionFrameRow = {sequence_number: number, timestamp: string, hash: string, frame_path: string}

export async function getSessionFrames(sessionId: string,): Promise<SessionFrame[]> {
    const { data, error } = await supabase
        .from('fingerprints')
        .select(
            'sequence_number, timestamp, hash, frame_path',
        )
        .eq('session_id', sessionId)
        .not('frame_path', 'is', null)
        .order('sequence_number', { ascending: true })

    if (error) {
        throw error
    }

    return ((data ?? []) as SessionFrameRow[]).map((row) => ({
        sequenceNumber: row.sequence_number,
        timestamp: row.timestamp,
        hash: row.hash,
        framePath: row.frame_path,
    }))
}