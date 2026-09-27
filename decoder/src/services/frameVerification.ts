import {supabase} from '../lib/supabase'
import type {SessionFrame} from './sessions'

export type FrameStatus = 'VALID' | 'MODIFIED' | 'MISSING'
export type VerifiedFrame = SessionFrame & {actualHash: string | null, valid: boolean, imageUrl: string | null, status: FrameStatus}

async function calculateSHA256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)

  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifyFrame(frame: SessionFrame,): Promise<VerifiedFrame> {
  const { data, error } = await supabase.storage.from('dashcam-frames').download(frame.framePath)

  if (error || !data) {
    console.error(
      `Frame ${frame.sequenceNumber} could not be downloaded:`,
      error,
    )

    return {
      ...frame,
      actualHash: null,
      valid: false,
      imageUrl: null,
      status: 'MISSING',
    }
  }

  const actualHash = await calculateSHA256(data)

  const valid = actualHash === frame.hash
  const imageUrl = URL.createObjectURL(data)

  return {
    ...frame,
    actualHash,
    valid,
    imageUrl,
    status: valid ? 'VALID' : 'MODIFIED',
  }
}