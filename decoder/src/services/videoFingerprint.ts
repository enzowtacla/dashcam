import {calculateDHash} from './perceptualHash'

export type VideoFingerprint = {index: number, time: number, perceptualHash: string}

function waitForEvent(element: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleSuccess = () => {
      cleanup()
      resolve()
    }

    const handleError = () => {
      cleanup()

      reject(
        new Error(
          `Video error while waiting for ${event}.`,
        ),
      )
    }

    const cleanup = () => {
      element.removeEventListener(
        event,
        handleSuccess,
      )

      element.removeEventListener(
        'error',
        handleError,
      )
    }

    element.addEventListener(
      event,
      handleSuccess,
      { once: true },
    )

    element.addEventListener(
      'error',
      handleError,
      { once: true },
    )
  })
}

async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const seekPromise =
    waitForEvent(video, 'seeked')

  video.currentTime = time

  await seekPromise
}

export async function extractVideoFingerprints(file: File, intervalSeconds = 1): Promise<VideoFingerprint[]> {
  const video =
    document.createElement('video')

  const canvas =
    document.createElement('canvas')

  const context =
    canvas.getContext('2d', {
      willReadFrequently: true,
    })

  if (!context) {
    throw new Error(
      'Could not create video canvas.',
    )
  }

  const objectUrl =
    URL.createObjectURL(file)

  try {
    video.src = objectUrl
    video.preload = 'auto'
    video.muted = true

    await waitForEvent(
      video,
      'loadedmetadata',
    )

    if (
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    ) {
      throw new Error(
        'Invalid video duration.',
      )
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const fingerprints:
      VideoFingerprint[] = []

    let index = 1

    for (
      let time = 0;
      time < video.duration;
      time += intervalSeconds
    ) {
      const safeTime = Math.min(
        time,
        Math.max(
          0,
          video.duration - 0.001,
        ),
      )

      await seekVideo(
        video,
        safeTime,
      )

      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height,
      )

      fingerprints.push({
        index,
        time: safeTime,
        perceptualHash:
          calculateDHash(canvas),
      })

      index += 1
    }

    return fingerprints
  }
  finally {
    video.pause()
    video.removeAttribute('src')
    video.load()

    URL.revokeObjectURL(
      objectUrl,
    )
  }
}