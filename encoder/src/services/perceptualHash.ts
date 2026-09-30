export function calculateDHash(
  sourceCanvas: HTMLCanvasElement,
): string {
  // dHash 64-bit compare an image resized to 9x8
  const width = 9
  const height = 8

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', {
    willReadFrequently: true,
  })

  if (!context) {
    throw new Error(
      'Could not create perceptual hash canvas context.',
    )
  }

  // Resize the original frame to 9x8
  context.drawImage(
    sourceCanvas,
    0,
    0,
    width,
    height,
  )

  const imageData = context.getImageData(
    0,
    0,
    width,
    height,
  )

  const pixels = imageData.data

  let binaryHash = ''

  function grayscale(
    x: number,
    y: number,
  ): number {
    const index =
      (y * width + x) * 4

    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]

    // Standard luminance approximation
    return (
      0.299 * red +
      0.587 * green +
      0.114 * blue
    )
  }

  // Compare each pixel with the pixel
  // immediately to its right.
  //
  // 8 rows * 8 comparisons = 64 bits.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const current =
        grayscale(x, y)

      const next =
        grayscale(x + 1, y)

      binaryHash +=
        current > next ? '1' : '0'
    }
  }

  // Convert the 64-bit binary value into
  // a 16-character hexadecimal fingerprint
  let hexadecimalHash = ''

  for (
    let i = 0;
    i < binaryHash.length;
    i += 4
  ) {
    const nibble =
      binaryHash.slice(i, i + 4)

    hexadecimalHash +=
      parseInt(nibble, 2)
        .toString(16)
  }

  return hexadecimalHash
}