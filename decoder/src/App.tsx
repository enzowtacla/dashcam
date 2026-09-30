import { useEffect, useState } from 'react'
import './App.css'
import {getDriverSessions, getSessionFingerprints, type DriverSession} from './services/sessions'

import {verifyFingerprint,type VerifiedFingerprint} from './services/frameVerification'

import {extractVideoFingerprints} from './services/videoFingerprint'

import {hammingDistance, similarityPercentage} from './services/hammingDistance'

type VideoMatchResult = {
  videoIndex: number
  videoTime: number
  sessionSequenceNumber: number
  videoHash: string
  storedHash: string
  hammingDistance: number
  similarity: number
  matched: boolean
}

type VideoMatchSummary = {
  totalVideoFingerprints: number
  comparedFingerprints: number
  matchedFingerprints: number
  matchPercentage: number
  averageSimilarity: number
  averageHammingDistance: number
  startSequenceNumber: number | null
  endSequenceNumber: number | null
  startVideoTime: number | null
  endVideoTime: number | null
  results: VideoMatchResult[]
}

function App() {
  const [driverId, setDriverId] = useState('')
  const [sessions, setSessions] = useState<DriverSession[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] =  useState<string | null>(null)
  const [verifiedFingerprints, setVerifiedFingerprints] = useState<VerifiedFingerprint[]>([])
  const [verifying, setVerifying] = useState(false)
  const [currentFingerprintIndex, setCurrentFingerprintIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null)
  const [matchingVideo, setMatchingVideo] = useState(false)
  const [videoMatch, setVideoMatch] = useState<VideoMatchSummary | null>(null,)
  const [videoMatchError, setVideoMatchError] = useState<string | null>(null)
  const totalFrames = verifiedFingerprints.length
  const validFrames =verifiedFingerprints.filter((frame) => frame.status === 'VALID').length
  const integrityPercentage = totalFrames > 0 ? (validFrames / totalFrames) * 100 : 0

  async function handleSearchDriver() {
    const normalizedDriverId =
      driverId.trim()

    if (!normalizedDriverId) {
      setSearchError(
        'Please enter a Driver ID',
      )
      return
    }

    setSearching(true)
    setSearchError(null)
    setSessions([])
    setVerifiedFingerprints([])
    setCurrentFingerprintIndex(0)
    setVideoMatch(null)
    setVideoMatchError(null)

    try {
      const result =
        await getDriverSessions(
          normalizedDriverId,
        )

      setSessions(result)

      if (result.length === 0) {
        return
      }

      // Automatically verify the most recent session for this driver
      await handleOpenSession(
        result[0].sessionId,
      )
    }
    catch (error) {
      console.error(
        'Failed to load driver sessions:',
        error,
      )

      setSearchError(
        'Failed to load driver sessions',
      )
    }
    finally {
      setSearching(false)
    }
  }

  async function handleOpenSession(
    sessionId: string,
  ) {
    setVerifying(true)
    setVerifiedFingerprints([])
    setCurrentFingerprintIndex(0)
    setPlaying(false)
    setVideoMatch(null)
    setVideoMatchError(null)

    try {
      const fingerprints = await getSessionFingerprints(sessionId)

      const results: VerifiedFingerprint[] = []

      let previousStoredChainHash: string | null = null

      let expectedSequenceNumber = 1

      for (const fingerprint of fingerprints) {
        while (expectedSequenceNumber < fingerprint.sequenceNumber) {
          results.push({
            sequenceNumber:
              expectedSequenceNumber,

            timestamp: '',

            hash: '',

            chainHash: '',

            perceptualHash: null,

            calculatedChainHash: null,

            valid: false,

            status: 'MISSING',
          })

          console.log(
            `Fingerprint ${expectedSequenceNumber}: MISSING`,
          )

          expectedSequenceNumber += 1
        }

        const verified =await verifyFingerprint(fingerprint, previousStoredChainHash)

        results.push(verified)

        console.log(
          `Fingerprint ${fingerprint.sequenceNumber}:`,
          verified.status,
          {
            frameHash:
              fingerprint.hash,

            storedChainHash:
              fingerprint.chainHash,

            calculatedChainHash:
              verified.calculatedChainHash,

            perceptualHash:
              fingerprint.perceptualHash,
          },
        )

        previousStoredChainHash = fingerprint.chainHash

        expectedSequenceNumber = fingerprint.sequenceNumber + 1
      }

      setVerifiedFingerprints(results)

      console.log(
        'Integrity verification completed:',
        {
          total: results.length,

          valid:
            results.filter(
              (fingerprint) =>
                fingerprint.status ===
                'VALID',
            ).length,

          modified:
            results.filter(
              (fingerprint) =>
                fingerprint.status ===
                'MODIFIED',
            ).length,

          missing:
            results.filter(
              (fingerprint) =>
                fingerprint.status ===
                'MISSING',
            ).length,
        },
      )
    }
    catch (error) {
      console.error('Failed to verify session:',error)
    }
    finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    if (!playing || verifiedFingerprints.length === 0) {
      return
    }

    const interval =
      window.setInterval(() => {
        setCurrentFingerprintIndex(
          (current) => {
            if (
              current >=
              verifiedFingerprints.length -
                1
            ) {
              setPlaying(false)
              return 0
            }

            return current + 1
          },
        )
      }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [
    playing,
    verifiedFingerprints.length,
  ])

  async function handleVerifyVideo() {
    if (!selectedVideo) {
      setVideoMatchError(
        'Please select a video first.',
      )
      return
    }

    const storedFingerprints =
      verifiedFingerprints.filter(
        (fingerprint) =>
          fingerprint.status !==
            'MISSING' &&
          fingerprint.perceptualHash !==
            null,
      )

    if (storedFingerprints.length === 0) {
      setVideoMatchError('No perceptual fingerprints are available for this session.')
      return
    }

    setMatchingVideo(true)
    setVideoMatch(null)
    setVideoMatchError(null)

    const startTime = performance.now()

    try {
      const videoFingerprints =
        await extractVideoFingerprints(
          selectedVideo,
          1,
        )

      if (videoFingerprints.length === 0) {
        throw new Error('No fingerprints could be extracted from the video.',)
      }

      const HAMMING_THRESHOLD = 10

      let bestOffset = 0

      let bestScore = Number.POSITIVE_INFINITY

      for (let offset = 0; offset < storedFingerprints.length; offset += 1) {
        let totalDistance = 0
        let comparisons = 0


        for (let videoIndex = 0; videoIndex < videoFingerprints.length; videoIndex += 1) {
          const storedIndex = offset + videoIndex
          if (storedIndex >= storedFingerprints.length) {
            break
          }

          const stored = storedFingerprints[storedIndex]

          const video =videoFingerprints[videoIndex]

          if (!stored.perceptualHash) {
            continue
          }

          const distance = hammingDistance(video.perceptualHash,stored.perceptualHash)

          totalDistance += distance
          comparisons += 1
        }

        if (comparisons === 0) {
          continue
        }

        const minimumComparisons = Math.min(3, videoFingerprints.length,storedFingerprints.length)

        if (comparisons < minimumComparisons) {
          continue
        }

        const averageDistance = totalDistance / comparisons

        if (averageDistance < bestScore) {
          bestScore = averageDistance
          bestOffset = offset
        }

        if (averageDistance < bestScore) {
          bestScore = averageDistance
          bestOffset = offset
        }
      }

      const results: VideoMatchResult[] = []


      for (
        let videoIndex = 0;
        videoIndex <
        videoFingerprints.length;
        videoIndex += 1
      ) {
        const storedIndex = bestOffset + videoIndex

        if (storedIndex >= storedFingerprints.length) {
          break
        }

        const video = videoFingerprints[videoIndex]

        const stored =
          storedFingerprints[
            storedIndex
          ]

        if (
          !stored.perceptualHash
        ) {
          continue
        }

        const distance =
          hammingDistance(
            video.perceptualHash,
            stored.perceptualHash,
          )

        const similarity =
          similarityPercentage(
            video.perceptualHash,
            stored.perceptualHash,
          )

        results.push({
          videoIndex:
            video.index,

          videoTime:
            video.time,

          sessionSequenceNumber:
            stored.sequenceNumber,

          videoHash:
            video.perceptualHash,

          storedHash:
            stored.perceptualHash,

          hammingDistance:
            distance,

          similarity,

          matched:
            distance <=
            HAMMING_THRESHOLD,
        })
      }

      const matchedFingerprints =
        results.filter(
          (result) =>
            result.matched,
        ).length

      const matchPercentage =
        results.length === 0
          ? 0
          : (
              matchedFingerprints /
              results.length
            ) * 100

      const averageSimilarity =
        results.length === 0
          ? 0
          : results.reduce(
              (sum, result) =>
                sum +
                result.similarity,
              0,
            ) / results.length

      const averageHammingDistance =
        results.length === 0
          ? 0
          : results.reduce(
              (sum, result) =>
                sum +
                result.hammingDistance,
              0,
            ) / results.length

      const processingTime =
        performance.now() -
        startTime

      setVideoMatch({
        totalVideoFingerprints:
          videoFingerprints.length,

        comparedFingerprints:
          results.length,

        matchedFingerprints,

        matchPercentage,

        averageSimilarity,

        averageHammingDistance,

        startSequenceNumber:
          results.length > 0
            ? results[0]
                .sessionSequenceNumber
            : null,

        endSequenceNumber:
          results.length > 0
            ? results[
                results.length - 1
              ].sessionSequenceNumber
            : null,

        startVideoTime:
          results.length > 0
            ? results[0].videoTime
            : null,

        endVideoTime:
          results.length > 0
            ? results[
                results.length - 1
              ].videoTime
            : null,

        results,
      })

      console.log(
        'Video matching completed:',
        {
          bestOffset,
          averageDistance:
            bestScore,
          matchPercentage,
          averageSimilarity,
          processingTimeMs:
            processingTime,
          results,
        },
      )
    }
    catch (error) {
      console.error(
        'Video matching failed:',
        error,
      )

      setVideoMatchError(
        error instanceof Error
          ? error.message
          : 'Video matching failed.',
      )
    }
    finally {
      setMatchingVideo(false)
    }
  }

  const currentFingerprint =
    verifiedFingerprints[
      currentFingerprintIndex
    ]

  return (
    <main>
      <h1>Dashcam Video Decoder</h1>

      <p>
        Enter a Driver ID to retrieve
        recorded sessions:
      </p>

      <div>
        <input
          type="text"
          value={driverId}
          onChange={(event) =>
            setDriverId(
              event.target.value,
            )
          }
          placeholder="e.g. driver-01"
        />

        <button
          type="button"
          onClick={
            handleSearchDriver
          }
          disabled={searching}
        >
          {searching
            ? 'Searching...'
            : 'Search'}
        </button>
      </div>

      {searchError && (
        <p>{searchError}</p>
      )}

      {!searching &&
        sessions.length > 0 && (
          <section>
            <h2>
              Available sessions
            </h2>

            {sessions.map(
              (session) => (
                <div
                  key={
                    session.sessionId
                  }
                >
                  <p>
                    <strong>
                      Session ID:
                    </strong>{' '}
                    {
                      session.sessionId
                    }
                  </p>

                  <p>
                    <strong>
                      Started:
                    </strong>{' '}
                    {new Date(
                      session.startedAt,
                    ).toLocaleString()}
                  </p>

                  <p>
                    <strong>
                      Frames:
                    </strong>{' '}
                    {
                      session.fingerprintCount
                    }
                  </p>
                </div>
              ),
            )}
          </section>
        )}

      {verifying && (
        <p>
          Verifying fingerprint
          integrity...
        </p>
      )}

      {verifiedFingerprints.length >
        0 && (
        <>
          <section>
            <h2>
              Integrity verification
            </h2>

            <p>
              <strong>
                Total frames:
              </strong>{' '}
              {
                verifiedFingerprints.length
              }
            </p>

            <p>
              <strong>
                Valid:
              </strong>{' '}
              {
                verifiedFingerprints.filter(
                  (frame) =>
                    frame.status ===
                    'VALID',
                ).length
              }
            </p>

            <p>
              <strong>
                Modified:
              </strong>{' '}
              {
                verifiedFingerprints.filter(
                  (frame) =>
                    frame.status ===
                    'MODIFIED',
                ).length
              }
            </p>

            <p>
              <strong>
                Missing:
              </strong>{' '}
              {
                verifiedFingerprints.filter(
                  (frame) =>
                    frame.status ===
                    'MISSING',
                ).length
              }
            </p>

            <p>
              <strong>
                Overall integrity:
              </strong>{' '}
              {integrityPercentage.toFixed(
                1,
              )}
              %
            </p>

            <p>
              <strong>
                Session integrity:{' '}
              </strong>

              <strong
                style={{
                  color:
                    verifiedFingerprints.every(
                      (frame) =>
                        frame.status ===
                        'VALID',
                    )
                      ? 'green'
                      : 'red',
                }}
              >
                {verifiedFingerprints.every(
                  (frame) =>
                    frame.status ===
                    'VALID',
                )
                  ? 'VERIFIED'
                  : 'COMPROMISED'}
              </strong>
            </p>

            <div>
              <h2>
                Fingerprint
                verification
              </h2>

              {currentFingerprint && (
                <>
                  {currentFingerprint.status ===
                  'MISSING' ? (
                    <>
                      <p>
                        <strong>
                          Fingerprint:
                        </strong>{' '}
                        {currentFingerprintIndex +
                          1}{' '}
                        /{' '}
                        {
                          verifiedFingerprints.length
                        }
                      </p>

                      <p>
                        <strong>
                          Sequence
                          number:
                        </strong>{' '}
                        {
                          currentFingerprint.sequenceNumber
                        }
                      </p>

                      <p>
                        <strong
                          style={{
                            color:
                              'red',
                          }}
                        >
                          MISSING
                        </strong>
                      </p>

                      <p>
                        Fingerprint data
                        is unavailable
                        for this sequence
                        number.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        <strong>
                          Fingerprint:
                        </strong>{' '}
                        {currentFingerprintIndex +
                          1}{' '}
                        /{' '}
                        {
                          verifiedFingerprints.length
                        }
                      </p>

                      <p>
                        <strong>
                          Sequence
                          number:
                        </strong>{' '}
                        {
                          currentFingerprint.sequenceNumber
                        }
                      </p>

                      <p>
                        <strong>
                          Timestamp:
                        </strong>{' '}
                        {
                          currentFingerprint.timestamp
                        }
                      </p>

                      <p>
                        <strong>
                          Frame hash:
                        </strong>
                      </p>

                      <p
                        style={{
                          wordBreak:
                            'break-all',
                        }}
                      >
                        {
                          currentFingerprint.hash
                        }
                      </p>

                      <p>
                        <strong>
                          Perceptual
                          dHash:
                        </strong>
                      </p>

                      <p
                        style={{
                          wordBreak:
                            'break-all',
                        }}
                      >
                        {currentFingerprint.perceptualHash ??
                          'Not available'}
                      </p>

                      <p>
                        <strong>
                          Expected
                          integrity
                          proof:
                        </strong>
                      </p>

                      <p
                        style={{
                          wordBreak:
                            'break-all',
                        }}
                      >
                        {
                          currentFingerprint.chainHash
                        }
                      </p>

                      <p>
                        <strong>
                          Calculated
                          integrity
                          proof:
                        </strong>
                      </p>

                      <p
                        style={{
                          wordBreak:
                            'break-all',
                        }}
                      >
                        {currentFingerprint.calculatedChainHash ??
                          'Not available'}
                      </p>

                      <p>
                        <strong>
                          Integrity:{' '}
                        </strong>

                        <strong
                          style={{
                            color:
                              currentFingerprint.status ===
                              'VALID'
                                ? 'green'
                                : 'red',
                          }}
                        >
                          {
                            currentFingerprint.status
                          }
                        </strong>
                      </p>
                    </>
                  )}

                  <div>
                    <button
                      onClick={() =>
                        setCurrentFingerprintIndex(
                          (
                            current,
                          ) =>
                            Math.max(
                              0,
                              current -
                                1,
                            ),
                        )
                      }
                      disabled={
                        currentFingerprintIndex ===
                        0
                      }
                    >
                      Previous
                    </button>

                    <button
                      onClick={() =>
                        setPlaying(
                          (
                            current,
                          ) =>
                            !current,
                        )
                      }
                    >
                      {playing
                        ? 'Pause'
                        : 'Play'}
                    </button>

                    <button
                      onClick={() =>
                        setCurrentFingerprintIndex(
                          (
                            current,
                          ) =>
                            Math.min(
                              verifiedFingerprints.length -
                                1,
                              current +
                                1,
                            ),
                        )
                      }
                      disabled={
                        currentFingerprintIndex ===
                        verifiedFingerprints.length -
                          1
                      }
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          <hr />

          <section>
            <h2>
              Submitted video
              verification
            </h2>

            <p>
              Select a video to compare
              with the perceptual
              fingerprints stored for
              this session.
            </p>

            <input
              type="file"
              accept="video/*,.avi,.mkv,.mp4"
              onChange={(event) => {
                const file =
                  event.target
                    .files?.[0] ??
                  null

                setSelectedVideo(
                  file,
                )

                setVideoMatch(null)

                setVideoMatchError(
                  null,
                )
              }}
            />

            {selectedVideo && (
              <p>
                <strong>
                  Selected video:
                </strong>{' '}
                {selectedVideo.name}
              </p>
            )}

            <button
              type="button"
              disabled={
                !selectedVideo ||
                matchingVideo
              }
              onClick={
                handleVerifyVideo
              }
            >
              {matchingVideo
                ? 'Processing video...'
                : 'Verify submitted video'}
            </button>

            {videoMatchError && (
              <p
                style={{
                  color: 'red',
                }}
              >
                {videoMatchError}
              </p>
            )}

            {videoMatch && (
              <div>
                <h2>
                  Video matching
                  results
                </h2>

                <p>
                  <strong>
                    Extracted video
                    fingerprints:
                  </strong>{' '}
                  {
                    videoMatch.totalVideoFingerprints
                  }
                </p>

                <p>
                  <strong>
                    Compared
                    fingerprints:
                  </strong>{' '}
                  {
                    videoMatch.comparedFingerprints
                  }
                </p>

                <p>
                  <strong>
                    Matched
                    fingerprints:
                  </strong>{' '}
                  {
                    videoMatch.matchedFingerprints
                  }{' '}
                  /{' '}
                  {
                    videoMatch.comparedFingerprints
                  }
                </p>

                <p>
                  <strong>
                    Match
                    percentage:
                  </strong>{' '}
                  <strong>
                    {videoMatch.matchPercentage.toFixed(
                      2,
                    )}
                    %
                  </strong>
                </p>

                <p>
                  <strong>
                    Average
                    similarity:
                  </strong>{' '}
                  {videoMatch.averageSimilarity.toFixed(
                    2,
                  )}
                  %
                </p>

                <p>
                  <strong>
                    Average Hamming
                    distance:
                  </strong>{' '}
                  {videoMatch.averageHammingDistance.toFixed(
                    2,
                  )}
                </p>

                <p>
                  <strong>
                    Matching session
                    segment:
                  </strong>{' '}
                  {
                    videoMatch.startSequenceNumber
                  }
                  {' → '}
                  {
                    videoMatch.endSequenceNumber
                  }
                </p>

                <h3>
                  Fingerprint
                  comparison
                </h3>

                <table>
                  <thead>
                    <tr>
                      <th>
                        Video time
                      </th>

                      <th>
                        Session #
                      </th>

                      <th>
                        Hamming
                        distance
                      </th>

                      <th>
                        Similarity
                      </th>

                      <th>
                        Result
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {videoMatch.results.map(
                      (result) => (
                        <tr
                          key={`${result.videoIndex}-${result.sessionSequenceNumber}`}
                        >
                          <td>
                            {result.videoTime.toFixed(
                              2,
                            )}
                            s
                          </td>

                          <td>
                            {
                              result.sessionSequenceNumber
                            }
                          </td>

                          <td>
                            {
                              result.hammingDistance
                            }
                          </td>

                          <td>
                            {result.similarity.toFixed(
                              2,
                            )}
                            %
                          </td>

                          <td>
                            <strong
                              style={{
                                color:
                                  result.matched
                                    ? 'green'
                                    : 'red',
                              }}
                            >
                              {result.matched
                                ? 'MATCH'
                                : 'NO MATCH'}
                            </strong>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {!searching &&
        !searchError &&
        driverId.trim() &&
        sessions.length === 0 && (
          <p>
            No sessions found.
          </p>
        )}
    </main>
  )
}

export default App