import {supabase} from '../lib/supabase'

export type VideoIntegrityRecord = {
    session_id: string
    video_hash: string
    video_size: number
    algorithm: string
}

export async function getVideoIntegrity(sessionId: string): Promise<VideoIntegrityRecord | null>{
    const {data, error} = await supabase
        .from ('video_integrity')
        .select('session_id, video_hash, video_size, algorithm')
        .eq('session_id', sessionId)
        .maybeSingle()

    if(error){
        throw error
    }

    return data
}