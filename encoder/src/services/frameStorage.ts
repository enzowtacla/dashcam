import {supabase} from '../lib/supabase'

export async function uploadFrame(
    frame: Blob,
    driverId: string,
    sessionId: string,
    sequenceNumber: number,
  ): Promise<string> {

  const fileName = `${sequenceNumber.toString().padStart(6, '0')}.jpg`

  const framePath = `${driverId}/${sessionId}/${fileName}`

  const { error } = await supabase.storage.from('dashcam-frames').upload(framePath, frame, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (error) {
    throw error
  }

  return framePath
}