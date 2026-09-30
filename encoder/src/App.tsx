import {useEffect, useRef, useState} from 'react'
import './App.css'
import {sendFingerprint, type Fingerprint} from './services/fingerprint'
import {addToOfflineQueue, flushOfflineQueue, removeExpiredFingerprints} from './services/offlineQueue'
import {calculateDHash} from './services/perceptualHash'

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<number | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const sequenceNumberRef = useRef<number>(0)
  const previousChainHashRef = useRef<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [recording, setRecording] = useState(false)
  const [framesProcessed, setFramesProcessed] = useState(0)
  const [sessionId, setSessionId] =  useState<string | null>(null)
  const [driverId, setDriverId] = useState('')

  useEffect(() => {
    async function initializeOfflineQueue() {
      await removeExpiredFingerprints()

      if (navigator.onLine) {
        await flushOfflineQueue()
      }
    }

    async function handleOnline() {
      console.log(
        'Internet connection restored',
      )

      await removeExpiredFingerprints()
      await flushOfflineQueue()

      console.log(
        'Offline queue processed',
      )
    }

    initializeOfflineQueue()

    window.addEventListener(
      'online',
      handleOnline,
    )

    return () => {
      window.removeEventListener(
        'online',
        handleOnline,
      )
    }
  }, [])

  async function startCamera() {
    try {
      const stream =
        await navigator.mediaDevices
          .getUserMedia({
            video: true,
            audio: false,
          })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream

        setCameraActive(true)
      }
    }
    catch (error) {
      console.error(
        'Could not access camera:',
        error,
      )

      alert(
        'Could not access camera',
      )
    }
  }

  function stopCamera() {
    /*
     * Do not allow the camera to stop
     * while a trip is being recorded.
     */
    if (recording) {
      alert(
        'Stop the recording before stopping the camera.',
      )
      return
    }

    const stream =
      streamRef.current

    if (stream) {
      stream
        .getTracks()
        .forEach((track) => {
          track.stop()
        })
    }

    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject =
        null
    }

    setCameraActive(false)
  }

  async function sha256Text(
    value: string,
  ): Promise<string> {
    const encoded =
      new TextEncoder().encode(value)

    const digest =
      await crypto.subtle.digest(
        'SHA-256',
        encoded,
      )

    return Array.from(
      new Uint8Array(digest),
    )
      .map((byte) =>
        byte
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  }

  async function captureFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current

    const currentSessionId =
      sessionIdRef.current

    if (!video || !canvas) {
      console.error(
        'Video or canvas not available',
      )
      return
    }

    if (!currentSessionId) {
      console.error(
        'No active session',
      )
      return
    }

    if (!driverId.trim()) {
      console.error(
        'No Driver ID available',
      )
      return
    }

    const context =
      canvas.getContext('2d')

    if (!context) {
      console.error(
        'Could not get canvas context.',
      )
      return
    }

    canvas.width =
      video.videoWidth

    canvas.height =
      video.videoHeight

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height,
    )

    /*
     * Perceptual fingerprint used
     * for video similarity matching.
     */
    const perceptualHash =
      calculateDHash(canvas)

    console.log(
      'Perceptual dHash:',
      perceptualHash,
    )

    /*
     * Create the exact JPEG frame used
     * for the SHA-256 fingerprint.
     */
    const frameBlob =
      await new Promise<Blob>(
        (resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              }
              else {
                reject(
                  new Error(
                    'Failed to create JPEG frame.',
                  ),
                )
              }
            },
            'image/jpeg',
            0.9,
          )
        },
      )

    const frameBuffer =
      await frameBlob.arrayBuffer()

    const hashBuffer =
      await crypto.subtle.digest(
        'SHA-256',
        frameBuffer,
      )

    const hashArray =
      Array.from(
        new Uint8Array(hashBuffer),
      )

    const hashHex =
      hashArray
        .map((byte) =>
          byte
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')

    /*
     * Build SHA-256 hash chain.
     */
    const previousChainHash =
      previousChainHashRef.current

    const chainInput =
      previousChainHash === null
        ? hashHex
        : previousChainHash +
          hashHex

    const chainHash =
      await sha256Text(
        chainInput,
      )

    previousChainHashRef.current =
      chainHash

    sequenceNumberRef.current += 1

    const sequenceNumber =
      sequenceNumberRef.current

    const timestamp =
      new Date().toISOString()

    const fingerprint:
      Fingerprint = {
        driverId:
          driverId.trim(),

        sessionId:
          currentSessionId,

        sequenceNumber,

        timestamp,

        hash:
          hashHex,

        chainHash,

        perceptualHash,
      }

    try {
      await sendFingerprint(
        fingerprint,
      )

      console.log(
        'Fingerprint sent to cloud:',
        fingerprint,
      )
    }
    catch (error) {
      console.error(
        'Cloud transmission failed:',
        error,
      )

      await addToOfflineQueue(
        fingerprint,
      )

      console.log(
        'Fingerprint queued for later transmission',
      )
    }
  }

  function downloadRecordedVideo(
    chunks: Blob[],
    currentSessionId: string,
    mimeType: string,
  ) {
    if (chunks.length === 0) {
      console.error(
        'No recorded video data available.',
      )
      return
    }

    const videoBlob =
      new Blob(
        chunks,
        {
          type:
            mimeType ||
            'video/webm',
        },
      )

    const url =
      URL.createObjectURL(
        videoBlob,
      )

    const link =
      document.createElement('a')

    link.href = url

    link.download =
      `dashcam-${currentSessionId}.webm`

    document.body.appendChild(
      link,
    )

    link.click()

    document.body.removeChild(
      link,
    )

    window.setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 1000)

    console.log(
      'Recorded video downloaded:',
      link.download,
    )
  }

  function startVideoRecorder(
    currentSessionId: string,
  ) {
    const stream =
      streamRef.current

    if (!stream) {
      throw new Error(
        'Camera stream is not available.',
      )
    }

    recordedChunksRef.current = []

    /*
     * Prefer VP8 WebM because Firefox
     * and Chromium-based browsers
     * generally support it.
     */
    let mimeType =
      'video/webm'

    if (
      MediaRecorder.isTypeSupported(
        'video/webm;codecs=vp8',
      )
    ) {
      mimeType =
        'video/webm;codecs=vp8'
    }

    const recorder =
      new MediaRecorder(
        stream,
        {
          mimeType,
        },
      )

    recorder.ondataavailable =
      (event) => {
        if (
          event.data &&
          event.data.size > 0
        ) {
          recordedChunksRef.current.push(
            event.data,
          )
        }
      }

    recorder.onerror =
      (event) => {
        console.error(
          'MediaRecorder error:',
          event,
        )
      }

    recorder.onstop = () => {
      downloadRecordedVideo(
        recordedChunksRef.current,
        currentSessionId,
        recorder.mimeType,
      )

      recordedChunksRef.current = []

      mediaRecorderRef.current =
        null
    }

    mediaRecorderRef.current =
      recorder

    /*
     * Request data every second.
     */
    recorder.start(1000)

    console.log(
      'Video recording started:',
      currentSessionId,
      recorder.mimeType,
    )
  }

  function startRecording() {
    if (!driverId.trim()) {
      alert(
        'Please enter a Driver ID before recording.',
      )
      return
    }

    if (
      !cameraActive ||
      recording
    ) {
      return
    }

    if (!streamRef.current) {
      alert(
        'Camera stream is not available.',
      )
      return
    }

    const newSessionId =
      crypto.randomUUID()

    sessionIdRef.current =
      newSessionId

    setSessionId(
      newSessionId,
    )

    sequenceNumberRef.current = 0

    previousChainHashRef.current =
      null

    setFramesProcessed(0)

    try {
      /*
       * Start recording the same camera
       * stream used by captureFrame().
       */
      startVideoRecorder(
        newSessionId,
      )
    }
    catch (error) {
      console.error(
        'Could not start video recorder:',
        error,
      )

      alert(
        'Could not start video recording.',
      )

      return
    }

    setRecording(true)

    /*
     * Capture the first fingerprint
     * immediately.
     */
    void captureFrame().then(() => {
      setFramesProcessed(
        (current) =>
          current + 1,
      )
    })

    /*
     * Then capture one fingerprint
     * every second.
     */
    recordingIntervalRef.current =
      window.setInterval(() => {
        void captureFrame().then(() => {
          setFramesProcessed(
            (current) =>
              current + 1,
          )
        })
      }, 1000)
  }

  function stopRecording() {
    if (
      recordingIntervalRef.current !==
      null
    ) {
      window.clearInterval(
        recordingIntervalRef.current,
      )

      recordingIntervalRef.current =
        null
    }

    const recorder =
      mediaRecorderRef.current

    if (
      recorder &&
      recorder.state !== 'inactive'
    ) {
      recorder.stop()
    }

    setRecording(false)

    console.log(
      'Recording stopped',
    )
  }

  return (
    <main>
      <h1>
        Dashcam encoder
      </h1>

      <p>
        Driver side video
        fingerprinting transmitter
      </p>

      <div>
        <label htmlFor="driverId">
          Driver ID:
        </label>

        <input
          id="driverId"
          type="text"
          value={driverId}
          onChange={(event) =>
            setDriverId(
              event.target.value,
            )
          }
          placeholder="e.g. DRIVER-001"
          disabled={recording}
        />
      </div>

      <section>
        <h2>
          Camera
        </h2>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          width="640"
        />

        <canvas
          ref={canvasRef}
          width="640"
          height="480"
          style={{
            display: 'none',
          }}
        />

        <p>
          Status:{' '}
          {cameraActive
            ? 'Active'
            : 'Inactive'}
        </p>

        {!cameraActive ? (
          <button
            type="button"
            onClick={startCamera}
          >
            Start camera
          </button>
        ) : (
          <button
            type="button"
            onClick={stopCamera}
            disabled={recording}
          >
            Stop camera
          </button>
        )}

        {cameraActive && (
          <section>
            <h2>
              Recording
            </h2>

            <p>
              Status:{' '}
              {recording
                ? 'Recording'
                : 'Stopped'}
            </p>

            {sessionId && (
              <p>
                Session ID:{' '}
                {sessionId}
              </p>
            )}

            <p>
              Frames processed:{' '}
              {framesProcessed}
            </p>

            {!recording ? (
              <button
                type="button"
                onClick={
                  startRecording
                }
              >
                Start recording
              </button>
            ) : (
              <button
                type="button"
                onClick={
                  stopRecording
                }
              >
                Stop recording
              </button>
            )}
          </section>
        )}
      </section>
    </main>
  )
}

export default App