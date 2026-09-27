import {useEffect, useState} from 'react'
import './App.css'
import {getDriverSessions, getSessionFrames, type DriverSession, type SessionFrame} from './services/sessions'
import {verifyFrame, type VerifiedFrame} from './services/frameVerification'

function App() {
  const [driverId, setDriverId] = useState('')
  const [sessions, setSessions] = useState<DriverSession[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [sessionFrames, setSessionFrames] = useState<SessionFrame[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [verifiedFrames, setVerifiedFrames] = useState<VerifiedFrame[]>([])
  const [verifying, setVerifying] = useState(false)
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  async function handleSearchDriver() {
    const normalizedDriverId = driverId.trim()

    if (!normalizedDriverId) {
      setSearchError('Please enter a Driver ID')
      return
    }

    setSearching(true)
    setSearchError(null)
    setSessions([])

    try {
      const result = await getDriverSessions(normalizedDriverId)
      setSessions(result)
    }
    catch (error) {
      console.error('Failed to load driver sessions:', error)
      setSearchError('Failed to load driver sessions')
    } 
    finally {
      setSearching(false)
    }
  }

  async function handleOpenSession(sessionId: string) {
    setVerifying(true)
    setVerifiedFrames([])

    try {
      const frames = await getSessionFrames(sessionId)

      setSelectedSessionId(sessionId)
      setSessionFrames(frames)

      const results: VerifiedFrame[] = []

      for (const frame of frames) {
        const verified = await verifyFrame(frame)

        results.push(verified)

        console.log(
          `Frame ${frame.sequenceNumber}:`,
          verified.valid ? 'VALID' : 'MODIFIED',
          {
            expectedHash: frame.hash,
            actualHash: verified.actualHash,
            framePath: frame.framePath,
          },
        )
      }

      setVerifiedFrames(results)

      console.log('Integrity verification completed:', {
        total: results.length,
        valid: results.filter((frame) => frame.valid).length,
        invalid: results.filter((frame) => !frame.valid).length,
      })
    } 
    catch (error) {
      console.error('Failed to verify session:', error)
    } 
    finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    if (!playing || verifiedFrames.length === 0) {
      return
    }

    const interval = window.setInterval(() => {
      setCurrentFrameIndex((current) => {
        if (current >= verifiedFrames.length - 1) {
          setPlaying(false)
          return 0
        }

        return current + 1
      })
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [playing, verifiedFrames.length])

  return (
    <main>
      <h1>Dashcam Video Decoder</h1>

      <p>Enter a Driver ID to retrieve recorded sessions:</p>

      <div>
        <input
          type="text"
          value={driverId}
          onChange={(event) => setDriverId(event.target.value)}
          placeholder="e.g. driver-01"
        />

        <button
          type="button"
          onClick={handleSearchDriver}
          disabled={searching}
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searchError && (
        <p>{searchError}</p>
      )}

      {!searching && sessions.length > 0 && (
        <section>
          <h2>Available sessions</h2>

          {sessions.map((session) => (
            <div key={session.sessionId}>
              <p>
                <strong>Session ID:</strong>{' '}
                {session.sessionId}
              </p>

              <p>
                <strong>Started:</strong>{' '}
                {new Date(session.startedAt).toLocaleString()}
              </p>

              <p>
                <strong>Frames:</strong>{' '}
                {session.frameCount}
              </p>
              <button
                type="button"
                onClick={() => handleOpenSession(session.sessionId)}
              >
                Open session
              </button>
            </div>
          ))}
        </section>
      )}

      {selectedSessionId && (
        <section>
          <h2>Selected session</h2>

          <p><strong>Session ID:</strong>{' '}{selectedSessionId}</p>

          <p><strong>Frames loaded:</strong>{' '}{sessionFrames.length}</p>
        </section>
      )}

      {verifying && (
        <p>Verifying frame integrity...</p>
      )}

      {verifiedFrames.length > 0 && (
        <section>
          <h2>Integrity verification</h2>

          <p><strong>Total frames:</strong>{' '}{verifiedFrames.length}</p>

          <p>
            <strong>Valid:</strong>{' '}
            {verifiedFrames.filter((frame) => frame.status === 'VALID').length}
          </p>

          <p>
            <strong>Modified:</strong>{' '}
            {verifiedFrames.filter((frame) => frame.status === 'MODIFIED').length}
          </p>

          <p>
            <strong>Missing:</strong>{' '}
            {verifiedFrames.filter((frame) => frame.status === 'MISSING').length}
          </p>

          <p>
            <strong>Session integrity: </strong>

            <strong
              style={{
                color: verifiedFrames.every(
                  (frame) => frame.status === 'VALID',
                )
                  ? 'green'
                  : 'red',
              }}
            >
              {verifiedFrames.every(
                (frame) => frame.status === 'VALID',
              )
                ? 'VERIFIED'
                : 'COMPROMISED'}
            </strong>
          </p>

          <div>
            <h2>Dashcam reconstruction</h2>

            {verifiedFrames[currentFrameIndex] && (
              <>
                {verifiedFrames[currentFrameIndex].imageUrl ? (
                  <img
                    src={verifiedFrames[currentFrameIndex].imageUrl}
                    alt={`Frame ${verifiedFrames[currentFrameIndex].sequenceNumber}`}
                    width="640"
                  />
                ) : (
                  <div><p>Frame unavailable</p></div>
                )}

                <p>Frame {currentFrameIndex + 1} / {verifiedFrames.length}</p>

                <p>
                  Integrity:{' '}
                  <strong
                    style={{
                      color:
                        verifiedFrames[currentFrameIndex].status === 'VALID'
                          ? 'green'
                          : 'red',
                    }}
                  >
                    {verifiedFrames[currentFrameIndex].status}
                  </strong>
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentFrameIndex(0)
                    setPlaying(true)
                  }}
                >
                  Play
                </button>

                <button
                  type="button"
                  onClick={() => setPlaying(false)}
                >
                  Stop
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {!searching &&
        !searchError &&
        driverId.trim() &&
        sessions.length === 0 && (
          <p>No sessions found.</p>
        )}

    </main>
  )
}

export default App