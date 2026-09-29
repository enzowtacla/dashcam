import type { SessionFingerprint } from './sessions'

export type FingerprintStatus =
  | 'VALID'
  | 'MODIFIED'
  | 'MISSING'

export type VerifiedFingerprint = SessionFingerprint & {
  calculatedChainHash: string | null
  valid: boolean
  status: FingerprintStatus
}

async function calculateSHA256(
  value: string,
): Promise<string> {
  const encoded = new TextEncoder().encode(value)

  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    encoded,
  )

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) =>
      byte.toString(16).padStart(2, '0'),
    )
    .join('')
}

export async function verifyFingerprint(
  fingerprint: SessionFingerprint,
  previousChainHash: string | null,
): Promise<VerifiedFingerprint> {
  const chainInput =
    previousChainHash === null
      ? fingerprint.hash
      : previousChainHash + fingerprint.hash

  const calculatedChainHash =
    await calculateSHA256(chainInput)

  const valid =
    calculatedChainHash === fingerprint.chainHash

  return {
    ...fingerprint,
    calculatedChainHash,
    valid,
    status: valid
      ? 'VALID'
      : 'MODIFIED',
  }
}