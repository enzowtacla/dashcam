import {useEffect, useState} from 'react'
import './App.css'
import {getDriverSessions, getSessionFingerprints, type DriverSession} from './services/sessions'
import {verifyFingerprint, type VerifiedFingerprint,} from './services/frameVerification'

function App() {
  const [driverId, setDriverId] = useState('')
  const [sessions, setSessions] = useState<DriverSession[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [verifiedFingerprints, setverifiedFingerprints] = useState<VerifiedFingerprint[]>([])
  const [verifying, setVerifying] = useState(false)
  const [currentFingerprintIndex, setcurrentFingerprintIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const totalFrames = verifiedFingerprints.length
  const validFrames = verifiedFingerprints.filter(
    (frame) => frame.status === 'VALID',
  ).length

  const integrityPercentage =
    totalFrames > 0
      ? (validFrames / totalFrames) * 100
      : 0

  async function handleSearchDriver() {
    const normalizedDriverId = driverId.trim()

    if (!normalizedDriverId) {
      setSearchError('Please enter a Driver ID')
      return
    }

    setSearching(true)
    setSearchError(null)
    setSessions([])
    setverifiedFingerprints([])

    try {
      const result = await getDriverSessions(normalizedDriverId)

      setSessions(result)

      if (result.length === 0) {
        return
      }

      // Automatically open the most recent session
      await handleOpenSession(result[0].sessionId)
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
    setverifiedFingerprints([])

    try {
      const fingerprints =
        await getSessionFingerprints(sessionId)

      const results: VerifiedFingerprint[] = []

      let previousStoredChainHash: string | null = null
      let expectedSequenceNumber = 1

      for (const fingerprint of fingerprints) {
        // Detect missing fingerprints before the current one
        while (
          expectedSequenceNumber < fingerprint.sequenceNumber
        ) {
          results.push({
            sequenceNumber: expectedSequenceNumber,
            timestamp: '',
            hash: '',
            chainHash: '',
            calculatedChainHash: null,
            valid: false,
            status: 'MISSING',
          })

          console.log(
            `Fingerprint ${expectedSequenceNumber}: MISSING`,
          )

          expectedSequenceNumber += 1
        }

        // Verify the fingerprint that actually exists
        const verified = await verifyFingerprint(
          fingerprint,
          previousStoredChainHash,
        )

        results.push(verified)

        console.log(
          `Fingerprint ${fingerprint.sequenceNumber}:`,
          verified.status,
          {
            frameHash: fingerprint.hash,
            storedChainHash: fingerprint.chainHash,
            calculatedChainHash:
              verified.calculatedChainHash,
          },
        )

        // Use the stored chain hash to verify the next fingerprint
        previousStoredChainHash =
          fingerprint.chainHash

        expectedSequenceNumber =
          fingerprint.sequenceNumber + 1
      }

      setverifiedFingerprints(results)

      console.log(
        'Integrity verification completed:',
        {
          total: results.length,

          valid: results.filter(
            (fingerprint) =>
              fingerprint.status === 'VALID',
          ).length,

          modified: results.filter(
            (fingerprint) =>
              fingerprint.status === 'MODIFIED',
          ).length,

          missing: results.filter(
            (fingerprint) =>
              fingerprint.status === 'MISSING',
          ).length,
        },
      )
    }
    catch (error) {
      console.error(
        'Failed to verify session:',
        error,
      )
    }
    finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    if (!playing || verifiedFingerprints.length === 0) {
      return
    }

    const interval = window.setInterval(() => {
      setcurrentFingerprintIndex((current) => {
        if (current >= verifiedFingerprints.length - 1) {
          setPlaying(false)
          return 0
        }

        return current + 1
      })
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [playing, verifiedFingerprints.length])

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
                {session.fingerprintCount}
              </p>
            </div>
          ))}
        </section>
      )}

      {verifying && (
        <p>Verifying frame integrity...</p>
      )}

      {verifiedFingerprints.length > 0 && (
        <section>
          <h2>Integrity verification</h2>

          <p><strong>Total frames:</strong>{' '}{verifiedFingerprints.length}</p>

          <p>
            <strong>Valid:</strong>{' '}
            {verifiedFingerprints.filter((frame) => frame.status === 'VALID').length}
          </p>

          <p>
            <strong>Modified:</strong>{' '}
            {verifiedFingerprints.filter((frame) => frame.status === 'MODIFIED').length}
          </p>

          <p>
            <strong>Missing:</strong>{' '}
            {verifiedFingerprints.filter((frame) => frame.status === 'MISSING').length}
          </p>

          <p>
            <strong>Overall integrity:</strong>{' '}
            {integrityPercentage.toFixed(1)}%
          </p>

          <p>
            <strong>Session integrity: </strong>

            <strong
              style={{
                color: verifiedFingerprints.every(
                  (frame) => frame.status === 'VALID',
                )
                  ? 'green'
                  : 'red',
              }}
            >
              {verifiedFingerprints.every(
                (frame) => frame.status === 'VALID',
              )
                ? 'VERIFIED'
                : 'COMPROMISED'}
            </strong>
          </p>

          <div>
            <h2>Fingerprint verification</h2>

            {verifiedFingerprints[currentFingerprintIndex] && (
              <>
                {verifiedFingerprints[currentFingerprintIndex].status === 'MISSING' ? (
                  <>
                    <p>
                      <strong>Fingerprint:</strong>{' '}
                      {currentFingerprintIndex + 1} / {verifiedFingerprints.length}
                    </p>

                    <p>
                      <strong>Sequence number:</strong>{' '}
                      {verifiedFingerprints[currentFingerprintIndex].sequenceNumber}
                    </p>

                    <p>
                      <strong style={{ color: 'red' }}>
                        MISSING
                      </strong>
                    </p>

                    <p>
                      Fingerprint data is unavailable for this sequence number.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <strong>Fingerprint:</strong>{' '}
                      {currentFingerprintIndex + 1} / {verifiedFingerprints.length}
                    </p>

                    <p>
                      <strong>Sequence number:</strong>{' '}
                      {verifiedFingerprints[currentFingerprintIndex].sequenceNumber}
                    </p>

                    <p>
                      <strong>Timestamp:</strong>{' '}
                      {verifiedFingerprints[currentFingerprintIndex].timestamp}
                    </p>

                    <p>
                      <strong>Frame hash:</strong>
                    </p>

                    <p style={{ wordBreak: 'break-all' }}>
                      {verifiedFingerprints[currentFingerprintIndex].hash}
                    </p>

                    <p>
                      <strong>Expected integrity proof:</strong>
                    </p>

                    <p style={{ wordBreak: 'break-all' }}>
                      {verifiedFingerprints[currentFingerprintIndex].chainHash}
                    </p>

                    <p>
                      <strong>Calculated integrity proof:</strong>
                    </p>

                    <p style={{ wordBreak: 'break-all' }}>
                      {verifiedFingerprints[currentFingerprintIndex].calculatedChainHash ??
                        'Not available'}
                    </p>

                    <p>
                      <strong>Integrity: </strong>

                      <strong
                        style={{
                          color:
                            verifiedFingerprints[currentFingerprintIndex].status === 'VALID'
                              ? 'green'
                              : 'red',
                        }}
                      >
                        {verifiedFingerprints[currentFingerprintIndex].status}
                      </strong>
                    </p>
                  </>
                )}

                <div>
                  <button
                    onClick={() =>
                      setcurrentFingerprintIndex((current) =>
                        Math.max(0, current - 1),
                      )
                    }
                    disabled={currentFingerprintIndex === 0}
                  >
                    Previous
                  </button>

                  <button
                    onClick={() => setPlaying((current) => !current)}
                  >
                    {playing ? 'Pause' : 'Play'}
                  </button>

                  <button
                    onClick={() =>
                      setcurrentFingerprintIndex((current) =>
                        Math.min(
                          verifiedFingerprints.length - 1,
                          current + 1,
                        ),
                      )
                    }
                    disabled={
                      currentFingerprintIndex === verifiedFingerprints.length - 1
                    }
                  >
                    Next
                  </button>
                </div>
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