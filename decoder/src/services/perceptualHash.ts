export function calculateDHash(sourceCanvas: HTMLCanvasElement): string {
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

  context.drawImage(sourceCanvas, 0, 0, width, height)

  const imageData = context.getImageData(0, 0, width, height)

  const pixels = imageData.data

  function grayscale(x: number, y: number): number {
    const index = (y * width + x) * 4

    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]

    return (
      0.299 * red +
      0.587 * green +
      0.114 * blue
    )
  }

  let binaryHash = ''

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      binaryHash +=
        grayscale(x, y) >
        grayscale(x + 1, y)
          ? '1'
          : '0'
    }
  }

  let hexadecimalHash = ''

  for (let i = 0; i < binaryHash.length; i += 4) {
    hexadecimalHash +=
      parseInt(
        binaryHash.slice(i, i + 4),
        2,
      ).toString(16)
  }

  return hexadecimalHash
}