import { supabase } from '../lib/supabase'

export type VideoIntegrity = {
    sessionId: string
    videoHash: string
    videoSize: number
}

export async function sendVideoIntegrity(integrity: VideoIntegrity): Promise<void>{
    const{error} = await supabase.from('video_integrity').insert({
        session_id: integrity.sessionId,
        video_hash: integrity.videoHash,
        video_size: integrity.videoSize,
        algorithm: 'SHA-256'
    })

    if(error){
        throw error
    }
}