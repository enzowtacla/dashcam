import {useEffect, useRef, useState} from 'react'
import './App.css'
import {sendFingerprint, type Fingerprint,} from './services/fingerprint'
import { addToOfflineQueue, flushOfflineQueue, removeExpiredFingerprints} from './services/offlineQueue'
import { sendVideoIntegrity } from './services/videoIntegrity'
import { uploadFrame } from './services/frameStorage'

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  //Area where its possible to screenshot the video frame
  const canvasRef = useRef<HTMLCanvasElement>(null) 
  const [cameraActive, setCameraActive] = useState(false)
  const [recording, setRecording] = useState(false) //Recording control
  const [framesProcessed, setFramesProcessed] = useState(0) //Fingerprints were generated
  const recordingIntervalRef = useRef<number | null>(null) //1 second timer
  const [sessionId, setSessionId] = useState<string | null>(null) //Session ID for the current recording session
  const sessionIdRef = useRef<string | null>(null)
  const sequenceNumberRef = useRef<number>(0) //Sequence number for the fingerprints
  const mediaRecorderRef = useRef<MediaRecorder | null>(null) //Recording the video stream
  const recordedChunksRef = useRef<Blob[]>([]) //Store the recorded video chunks
  const streamRef = useRef<MediaStream | null>(null)
  const [driverId, setDriverId] = useState('')


  useEffect(()=>{
    async function initializeOfflineQueue() {
      await removeExpiredFingerprints()

      if (navigator.onLine) {
        await flushOfflineQueue()
      }
    }

    async function handleOnline(){
      console.log('Internet connection restored')

      await removeExpiredFingerprints()
      await flushOfflineQueue()

      console.log('Offline queue processed')
    }

    initializeOfflineQueue()

    window.addEventListener('online', handleOnline)

    return ()=>{
      window.removeEventListener('online', handleOnline)
    }
  }, [])
  
  async function startCamera() {
    try{
      //Access to the camera
      const stream = await navigator.mediaDevices.getUserMedia({video: true})
      streamRef.current = stream
      
      if (videoRef.current){
        //Access the video stream and set it as the source for the video element
        videoRef.current.srcObject = stream 
        setCameraActive(true)
      }
    }
    catch (error) {
      console.error('Could not access camera:', error)
      alert('Could not access camera')
    }
  }

  function stopCamera() {
    const video = videoRef.current

    if(video?.srcObject){
      const stream = video.srcObject as MediaStream

      stream.getTracks().forEach(track => {track.stop()})

      video.srcObject = null
      setCameraActive(false)
    }
  }

  async function captureFrame() {
  const video = videoRef.current
  const canvas = canvasRef.current
  const currentSessionId = sessionIdRef.current

  if (!video || !canvas) {
    console.error('Video or canvas not available')
    return
  }

  if (!currentSessionId) {
    console.error('No active session')
    return
  }

  if (!driverId.trim()) {
    console.error('No Driver ID available')
    return
  }

  const context = canvas.getContext('2d')

  if (!context) {
    console.error('Could not get canvas context.')
    return
  }

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  const frameBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create JPEG frame.'))
        }
      },
      'image/jpeg',0.9
    )
  })

  const frameBuffer = await frameBlob.arrayBuffer()

  const hashBuffer = await crypto.subtle.digest('SHA-256', frameBuffer)

  const hashArray = Array.from(new Uint8Array(hashBuffer))

  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')

  sequenceNumberRef.current += 1

  const sequenceNumber = sequenceNumberRef.current
  const timestamp = new Date().toISOString()

    try {
      const framePath = await uploadFrame(frameBlob, driverId.trim(), currentSessionId,sequenceNumber)

      console.log('Frame uploaded:', framePath)

      const fingerprint: Fingerprint = {
        driverId: driverId.trim(),
        sessionId: currentSessionId,
        sequenceNumber,
        timestamp,
        hash: hashHex,
        framePath,
      }

      await sendFingerprint(fingerprint)

      console.log('Fingerprint sent to cloud:', fingerprint)
    }
    catch (error) {
      console.error('Cloud transmission failed:', error)

      const offlineFingerprint: Fingerprint = {
        driverId: driverId.trim(),
        sessionId: currentSessionId,
        sequenceNumber,
        timestamp,
        hash: hashHex,
        framePath: '',
      }

      await addToOfflineQueue(offlineFingerprint, frameBlob)

      console.log('Frame and fingerprint queued for later transmission')
    }

  //setLastTimestamp(timestamp)
  //setLastHash(hashHex)
  //setFrameCount(sequenceNumber)
}

  function startVideoRecording(){
    const stream = streamRef.current

    if(!stream){
      console.error('No camera stream available')
      return
    }

    recordedChunksRef.current = []
  

    const mediaRecorder = new MediaRecorder(stream, {mimeType: 'video/webm'})
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data)
      }
    }

    mediaRecorder.start(1000)

    mediaRecorderRef.current = mediaRecorder

    console.log('Video recording started')
  }

  function stopVideoRecording(){
    const mediaRecorder = mediaRecorderRef.current

    if(!mediaRecorder || mediaRecorder.state === 'inactive'){
      return
    }

    mediaRecorder.onstop = async () => {
      const videoBlob = new Blob(recordedChunksRef.current, {type: 'video/webm',})
      const videoBuffer = await videoBlob.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', videoBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const videoHash = hashArray.map((byte) => byte.toString(16).padStart(2,'0')).join('')
      console.log('Final video fingerprint:', {
        sessionId: sessionIdRef.current,
        size: videoBlob.size,
        hash: videoHash,
      })
      const currentSessionId = sessionIdRef.current


      if (!currentSessionId) {
        console.error('No session ID available for video integrity.')
        return
      }

      try {
        await sendVideoIntegrity({
        sessionId: currentSessionId,
        videoHash,
        videoSize: videoBlob.size,
      })

      console.log('Final video fingerprint sent to cloud')} catch (error) {
        console.error('Failed to send final video fingerprint:',error,)
      }
      const videoUrl = URL.createObjectURL(videoBlob)
      const link = document.createElement('a')

      link.href = videoUrl
      link.download = `dashcam_${sessionIdRef.current}.webm`
      link.click()

      URL.revokeObjectURL(videoUrl)
      recordedChunksRef.current = []

      console.log('Video recording stopped and saved')
    }

    mediaRecorder.stop()
  }

  function startRecording() {
    if (!driverId.trim()) {
      alert('Please enter a Driver ID before recording.')
      return
    }

    if(!cameraActive || recording){return}

    const newSessionId = crypto.randomUUID()
    sessionIdRef.current = newSessionId
    setSessionId(newSessionId)
    sequenceNumberRef.current = 0
    startVideoRecording()

    setFramesProcessed(0)
    setRecording(true)

    recordingIntervalRef.current = window.setInterval(async()=>{
      await captureFrame()
      setFramesProcessed((current) => current + 1)
    }, 1000)
  }

  function stopRecording() {
    if(recordingIntervalRef.current !== null){
      window.clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }

    stopVideoRecording()
    setRecording(false)
  }

  return(
    <main>
      <h1>Dashcam encoder</h1>

      <p>Driver side video fingerprinting transmitter</p>

      <div>
        <label htmlFor="driverId">
        Driver ID:
        </label>

        <input
          id="driverId"
          type="text"
          value={driverId}
          onChange={(event) => setDriverId(event.target.value)}
          placeholder="e.g. DRIVER-001"
          disabled={recording}
        />
      </div>

      <section>
        <h2>Camera</h2>

        <video ref={videoRef} autoPlay playsInline width="640"/>
        <canvas ref={canvasRef} width="640" height="480" style={{display: 'none'}}/>

        <p>Status: {cameraActive ? 'Active' : 'Inactive'}</p>

       {!cameraActive ? (<button type="button" onClick={startCamera}>Start camera</button>) : 
       (<button type="button" onClick={stopCamera}>Stop camera</button>)}
       
       {cameraActive && (<button type="button" onClick={captureFrame}>Capture frame</button>)}

       {cameraActive && (
        <section>
          <h2>Recording</h2>
          <p>Status: {recording ? 'Recording' : 'Stopped'}</p>
          {sessionId && <p>Session ID: {sessionId}</p>}
          <p>Frames processed: {framesProcessed}</p>
          {!recording ? (<button type="button" onClick={startRecording}>Start recording</button>):
          (<button type="button" onClick={stopRecording}>Stop recording</button>)}
        </section>
       )}
      </section>
    </main>
  )
}

 export default App