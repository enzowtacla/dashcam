import {useRef, useState} from 'react'
import './App.css'
type Fingerprint = {sequenceNumber: number, timeStamp: string, hash: string}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  //Area where its possible to screenshot the video frame
  const canvasRef = useRef<HTMLCanvasElement>(null) 
  const [cameraActive, setCameraActive] = useState(false)
  const [recording, setRecording] = useState(false) //Recording control
  const [framesProcessed, setFramesProcessed] = useState(0) //Fingerprints were generated
  const recordingIntervalRef = useRef<number | null>(null) //1 second timer
  const [sessionId, setSessionId] = useState<string | null>(null) //Session ID for the current recording session
  const sequenceNumberRef = useRef<number>(0) //Sequence number for the fingerprints

  async function startCamera() {
    try{
      //Access to the camera
      const stream = await navigator.mediaDevices.getUserMedia({video: true})
      
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

    if(!video || !canvas){return}

    const context = canvas.getContext('2d')
    
    if(!context){return}

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    //Copy what is currently being displayed in the video element to the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png')
    })

    if(!blob){
      console.error('Could not convert frame to image')
      return
    }

    const frameData = await blob.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', frameData)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
    const timeStamp = new Date().toISOString()

    sequenceNumberRef.current += 1

    const fingerprint: Fingerprint = {
      sequenceNumber: sequenceNumberRef.current,
      timeStamp,
      hash: hashHex
    }

    console.log('Frame fingerprint:', fingerprint)
  }

  function startRecording() {
    if(!cameraActive || recording){return}

    const newSessionId = crypto.randomUUID()
    setSessionId(newSessionId)
    sequenceNumberRef.current = 0

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

    setRecording(false)
  }

  return(
    <main>
      <h1>Dashcam encoder</h1>

      <p>Driver side video fingerprinting transmitter</p>

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