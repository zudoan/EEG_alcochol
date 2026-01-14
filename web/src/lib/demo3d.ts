export function demoLabelDist() {
  return [
    { label: 'Control (c=0)', value: 240, color: '#a5b4fc' },
    { label: 'Alcoholic (a=1)', value: 240, color: '#ec4899' },
  ]
}

export function demoFreqMatrix(rows = 14, cols = 18) {
  const z: number[][] = []
  for (let r = 0; r < rows; r++) {
    const row: number[] = []
    for (let c = 0; c < cols; c++) {
      const t = (r / rows) * 0.9 + (c / cols) * 0.8
      const v = Math.sin(t * 2.4) * 0.45 + Math.cos((r - c) * 0.35) * 0.25 + Math.random() * 0.12
      row.push(v)
    }
    z.push(row)
  }
  return z
}

export function demoCircularValues(n = 32) {
  return Array.from({ length: n }).map((_, i) => {
    const t = i / n
    return Math.sin(t * Math.PI * 2) * 0.6 + Math.cos(t * Math.PI * 6) * 0.25 + Math.random() * 0.15
  })
}
