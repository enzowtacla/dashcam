import { supabase } from '../lib/supabase'

export type Fingerprint = {
  driverId: string
  sessionId: string
  sequenceNumber: number
  timestamp: string

  // Exact cryptographic fingerprint.
  hash: string

  // SHA-256 hash-chain integrity proof.
  chainHash: string

  // 64-bit perceptual dHash.
  perceptualHash: string
}

export async function sendFingerprint(
  fingerprint: Fingerprint,
): Promise<void> {
  const { error } = await supabase
    .from('fingerprints')
    .insert({
      driver_id: fingerprint.driverId,
      session_id: fingerprint.sessionId,
      sequence_number:
        fingerprint.sequenceNumber,
      timestamp: fingerprint.timestamp,
      hash: fingerprint.hash,
      chain_hash: fingerprint.chainHash,
      perceptual_hash:
        fingerprint.perceptualHash,
    })

  if (error) {
    throw error
  }
}