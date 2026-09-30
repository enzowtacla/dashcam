function hexToBinary(hexadecimal: string): string {
  return hexadecimal
    .toLowerCase()
    .split('')
    .map((character) => {
      const value = parseInt(character, 16)

      if (Number.isNaN(value)) {
        throw new Error(
          `Invalid hexadecimal hash: ${hexadecimal}`,
        )
      }

      return value
        .toString(2)
        .padStart(4, '0')
    })
    .join('')
}

export function hammingDistance(hashA: string, hashB: string): number {
  const binaryA = hexToBinary(hashA)
  const binaryB = hexToBinary(hashB)

  if (binaryA.length !== binaryB.length) {
    throw new Error(
      'Hashes must have the same length.',
    )
  }

  let distance = 0

  for (
    let i = 0;
    i < binaryA.length;
    i += 1
  ) {
    if (binaryA[i] !== binaryB[i]) {
      distance += 1
    }
  }

  return distance
}

export function normalizedHammingDistance(hashA: string, hashB: string): number {
  const bits = hashA.length * 4

  return (
    hammingDistance(hashA, hashB) /
    bits
  )
}

export function similarityPercentage(hashA: string, hashB: string): number {
  return (
    1 -
    normalizedHammingDistance(
      hashA,
      hashB,
    )
  ) * 100
}