import {supabase} from '../lib/supabase'

export type Fingerprint = {sessionId: string, sequenceNumber: number, timestamp: string, hash: string}

export async function sendFingerprint(fingerprint: Fingerprint): Promise<void> {
    const {error} = await supabase.from('fingerprints').insert({
        session_id: fingerprint.sessionId,
        sequence_number: fingerprint.sequenceNumber,
        timestamp: fingerprint.timestamp,
        hash: fingerprint.hash,
    })

    if (error) {
        throw error
    }
}