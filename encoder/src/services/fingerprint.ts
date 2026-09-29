import { supabase } from '../lib/supabase'

export type Fingerprint = {
    driverId: string
    sessionId: string
    sequenceNumber: number
    timestamp: string
    hash: string
    chainHash: string
}

export async function sendFingerprint(fingerprint: Fingerprint): Promise<void> {
    const { error } = await supabase
        .from('fingerprints')
        .insert({
            driver_id: fingerprint.driverId,
            session_id: fingerprint.sessionId,
            sequence_number: fingerprint.sequenceNumber,
            timestamp: fingerprint.timestamp,
            hash: fingerprint.hash,
            chain_hash: fingerprint.chainHash,
        })

    if (error) {
        throw error
    }
}