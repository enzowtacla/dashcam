import {useRef, useState} from 'react'
import './App.css'

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraActive, setCameraActive] = useState(false)

  async function startCamera() {
    try{
      //Access to the camera
      const stream = await navigator.mediaDevices.getUserMedia({video: true})
      
      if (videoRef.current){
        videoRef.current.srcObject = stream //Access the video stream and set it as the source for the video element
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

  return(
    <main>
      <h1>Dashcam encoder</h1>

      <p>Driver side video fingerprinting transmitter</p>

      <section>
        <h2>Camera</h2>

        <video ref={videoRef} autoPlay playsInline width="640"/>

        <p>Status: {cameraActive ? 'Active' : 'Inactive'}</p>

       {!cameraActive ? (<button type="button" onClick={startCamera}>Start camera</button>) : 
       (<button type="button" onClick={stopCamera}>Stop camera</button>)}
      </section>
    </main>
  )
}

 export default App