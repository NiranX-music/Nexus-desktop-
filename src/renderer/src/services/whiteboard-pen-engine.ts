import {
  TLDefaultColorStyle,
  TLDefaultSizeStyle,
  TLGeoShapeGeoStyle,
  TLShapePartial,
  b64Vecs,
  createShapeId,
  toRichText
} from 'tldraw'

export type BoardColor =
  | 'black'
  | 'grey'
  | 'light-violet'
  | 'violet'
  | 'blue'
  | 'light-blue'
  | 'yellow'
  | 'orange'
  | 'green'
  | 'light-green'
  | 'light-red'
  | 'red'

export type StrokeSize = 's' | 'm' | 'l' | 'xl'

export interface Vec3 {
  x: number
  y: number
  z: number
}

// ============================================================================
// 1. STROKE GLYPH DICTIONARY FOR HANDWRITTEN INK (A-Z, a-z, 0-9, Symbols)
// Coordinates in normalized glyph box [0..20, 0..30]
// ============================================================================
type RawStroke = [number, number][]

const GLYPHS: Record<string, RawStroke[]> = {
  // Uppercase
  A: [
    [[2, 30], [10, 2], [18, 30]],
    [[5, 19], [15, 19]]
  ],
  B: [
    [[4, 2], [4, 30]],
    [[4, 2], [13, 2], [17, 7], [13, 14], [4, 14]],
    [[4, 14], [14, 14], [18, 21], [14, 30], [4, 30]]
  ],
  C: [
    [[18, 7], [12, 2], [6, 8], [4, 16], [6, 24], [13, 30], [18, 25]]
  ],
  D: [
    [[4, 2], [4, 30]],
    [[4, 2], [12, 2], [18, 10], [18, 21], [12, 30], [4, 30]]
  ],
  E: [
    [[4, 2], [4, 30]],
    [[4, 2], [17, 2]],
    [[4, 15], [14, 15]],
    [[4, 30], [17, 30]]
  ],
  F: [
    [[4, 2], [4, 30]],
    [[4, 2], [17, 2]],
    [[4, 15], [14, 15]]
  ],
  G: [
    [[18, 7], [12, 2], [6, 8], [4, 16], [6, 24], [13, 30], [18, 25], [18, 17], [12, 17]]
  ],
  H: [
    [[4, 2], [4, 30]],
    [[16, 2], [16, 30]],
    [[4, 16], [16, 16]]
  ],
  I: [
    [[10, 2], [10, 30]],
    [[4, 2], [16, 2]],
    [[4, 30], [16, 30]]
  ],
  J: [
    [[14, 2], [14, 24], [11, 29], [6, 29], [3, 24], [3, 18]],
    [[8, 2], [19, 2]]
  ],
  K: [
    [[4, 2], [4, 30]],
    [[17, 4], [4, 17], [17, 30]]
  ],
  L: [
    [[5, 2], [5, 30], [17, 30]]
  ],
  M: [
    [[3, 30], [3, 2], [10, 19], [17, 2], [17, 30]]
  ],
  N: [
    [[4, 30], [4, 2], [16, 30], [16, 2]]
  ],
  O: [
    [[10, 2], [5, 7], [3, 16], [5, 24], [10, 30], [15, 24], [17, 16], [15, 7], [10, 2]]
  ],
  P: [
    [[4, 2], [4, 30]],
    [[4, 2], [13, 2], [17, 7], [13, 15], [4, 15]]
  ],
  Q: [
    [[10, 2], [5, 7], [3, 16], [5, 24], [10, 30], [15, 24], [17, 16], [15, 7], [10, 2]],
    [[12, 22], [18, 30]]
  ],
  R: [
    [[4, 2], [4, 30]],
    [[4, 2], [13, 2], [17, 7], [13, 15], [4, 15]],
    [[11, 15], [17, 30]]
  ],
  S: [
    [[16, 6], [12, 2], [6, 5], [4, 10], [8, 14], [13, 17], [16, 22], [13, 29], [6, 29], [3, 25]]
  ],
  T: [
    [[10, 2], [10, 30]],
    [[2, 2], [18, 2]]
  ],
  U: [
    [[4, 2], [4, 22], [8, 29], [13, 29], [16, 22], [16, 2]]
  ],
  V: [
    [[2, 2], [10, 30], [18, 2]]
  ],
  W: [
    [[2, 2], [6, 30], [10, 14], [14, 30], [18, 2]]
  ],
  X: [
    [[3, 2], [17, 30]],
    [[17, 2], [3, 30]]
  ],
  Y: [
    [[3, 2], [10, 15], [17, 2]],
    [[10, 15], [10, 30]]
  ],
  Z: [
    [[3, 3], [17, 3]],
    [[17, 3], [3, 29]],
    [[3, 29], [17, 29]]
  ],

  // Lowercase
  a: [
    [[15, 12], [9, 10], [5, 14], [5, 22], [9, 27], [15, 27], [15, 10], [15, 30]],
    [[15, 18], [9, 18]]
  ],
  b: [
    [[4, 2], [4, 30]],
    [[4, 16], [10, 11], [15, 14], [15, 23], [10, 28], [4, 27]]
  ],
  c: [
    [[15, 13], [10, 10], [6, 14], [5, 20], [7, 26], [12, 28], [15, 25]]
  ],
  d: [
    [[15, 2], [15, 30]],
    [[15, 24], [11, 28], [5, 24], [5, 16], [9, 11], [15, 13]]
  ],
  e: [
    [[4, 19], [15, 19], [14, 13], [10, 10], [5, 14], [4, 22], [8, 28], [15, 26]]
  ],
  f: [
    [[14, 4], [10, 2], [7, 5], [7, 30]],
    [[3, 14], [12, 14]]
  ],
  g: [
    [[15, 12], [9, 10], [5, 14], [5, 21], [10, 26], [15, 24], [15, 10]],
    [[15, 12], [15, 33], [11, 38], [5, 37], [4, 32]]
  ],
  h: [
    [[4, 2], [4, 30]],
    [[4, 16], [9, 11], [14, 14], [14, 30]]
  ],
  i: [
    [[9, 11], [9, 29], [12, 29]],
    [[9, 5], [9.5, 6]]
  ],
  j: [
    [[13, 11], [13, 33], [10, 38], [5, 37], [4, 32]],
    [[13, 5], [13.5, 6]]
  ],
  k: [
    [[4, 2], [4, 30]],
    [[14, 12], [4, 20], [15, 30]]
  ],
  l: [
    [[8, 2], [8, 28], [12, 29]]
  ],
  m: [
    [[3, 11], [3, 30]],
    [[3, 17], [7, 11], [10, 14], [10, 30]],
    [[10, 17], [14, 11], [17, 14], [17, 30]]
  ],
  n: [
    [[4, 11], [4, 30]],
    [[4, 17], [9, 11], [14, 14], [14, 30]]
  ],
  o: [
    [[10, 11], [6, 14], [5, 20], [7, 26], [11, 28], [15, 24], [16, 18], [14, 13], [10, 11]]
  ],
  p: [
    [[4, 11], [4, 38]],
    [[4, 16], [9, 11], [14, 14], [14, 22], [9, 27], [4, 25]]
  ],
  q: [
    [[15, 11], [15, 38]],
    [[15, 23], [11, 27], [6, 23], [5, 16], [9, 11], [15, 14]]
  ],
  r: [
    [[4, 11], [4, 30]],
    [[4, 18], [8, 12], [14, 12]]
  ],
  s: [
    [[14, 14], [10, 11], [6, 13], [5, 17], [9, 20], [13, 23], [14, 27], [10, 29], [5, 28]]
  ],
  t: [
    [[7, 4], [7, 27], [11, 29]],
    [[3, 12], [12, 12]]
  ],
  u: [
    [[4, 11], [4, 24], [8, 28], [13, 28], [14, 22]],
    [[14, 11], [14, 30]]
  ],
  v: [
    [[3, 11], [8, 29], [14, 11]]
  ],
  w: [
    [[2, 11], [5, 29], [8, 17], [11, 29], [15, 11]]
  ],
  x: [
    [[4, 11], [14, 29]],
    [[14, 11], [4, 29]]
  ],
  y: [
    [[3, 11], [8, 24], [13, 11]],
    [[13, 11], [13, 33], [9, 38], [5, 37]]
  ],
  z: [
    [[4, 12], [14, 12], [4, 28], [14, 28]]
  ],

  // Digits
  '0': [
    [[10, 2], [5, 7], [4, 16], [6, 24], [10, 30], [15, 24], [16, 15], [14, 6], [10, 2]],
    [[14, 8], [6, 24]]
  ],
  '1': [
    [[6, 8], [10, 2], [10, 30]],
    [[5, 30], [15, 30]]
  ],
  '2': [
    [[4, 8], [7, 3], [13, 3], [16, 7], [16, 12], [4, 29], [17, 29]]
  ],
  '3': [
    [[4, 4], [15, 4], [9, 14], [14, 16], [16, 22], [12, 29], [5, 28]]
  ],
  '4': [
    [[13, 2], [4, 19], [17, 19]],
    [[13, 10], [13, 30]]
  ],
  '5': [
    [[15, 3], [5, 3], [4, 14], [10, 12], [15, 16], [15, 24], [11, 29], [4, 28]]
  ],
  '6': [
    [[14, 5], [8, 9], [5, 16], [5, 24], [10, 29], [15, 25], [15, 18], [10, 16], [5, 20]]
  ],
  '7': [
    [[3, 3], [16, 3], [8, 30]],
    [[5, 16], [12, 16]]
  ],
  '8': [
    [[10, 2], [5, 6], [6, 12], [10, 16], [14, 20], [14, 26], [10, 30], [5, 26], [5, 20], [10, 16], [14, 12], [14, 6], [10, 2]]
  ],
  '9': [
    [[14, 16], [10, 13], [5, 15], [5, 8], [9, 3], [14, 5], [14, 25], [10, 30], [5, 28]]
  ],

  '.': [
    [[9, 27], [10, 28]]
  ],
  ',': [
    [[9, 26], [9, 29], [7, 33]]
  ],
  '!': [
    [[10, 3], [10, 21]],
    [[10, 27], [10.5, 28]]
  ],
  '?': [
    [[5, 7], [8, 3], [13, 3], [16, 7], [15, 13], [10, 17], [10, 21]],
    [[10, 27], [10.5, 28]]
  ],
  ':': [
    [[10, 10], [10.5, 11]],
    [[10, 23], [10.5, 24]]
  ],
  ';': [
    [[10, 10], [10.5, 11]],
    [[10, 23], [10, 26], [8, 29]]
  ],
  '-': [[[4, 16], [16, 16]]],
  '+': [
    [[10, 7], [10, 25]],
    [[3, 16], [17, 16]]
  ],
  '=': [
    [[4, 12], [16, 12]],
    [[4, 20], [16, 20]]
  ],
  '*': [
    [[10, 8], [10, 24]],
    [[4, 11], [16, 21]],
    [[4, 21], [16, 11]]
  ],
  '/': [[[4, 29], [16, 3]]],
  '\\': [[[4, 3], [16, 29]]],
  '(': [[[14, 2], [8, 10], [6, 16], [8, 22], [14, 30]]],
  ')': [[[6, 2], [12, 10], [14, 16], [12, 22], [6, 30]]],
  '[': [[[14, 2], [6, 2], [6, 30], [14, 30]]],
  ']': [[[6, 2], [14, 2], [14, 30], [6, 30]]],
  '<': [[[15, 7], [4, 16], [15, 25]]],
  '>': [[[4, 7], [15, 16], [4, 25]]],
  '_': [[[2, 30], [18, 30]]],
  '|': [[[10, 2], [10, 30]]],
  '^': [[[4, 14], [10, 4], [16, 14]]],
  '%': [
    [[4, 29], [16, 3]],
    [[5, 6], [7, 6], [7, 9], [5, 9], [5, 6]],
    [[13, 23], [15, 23], [15, 26], [13, 26], [13, 23]]
  ],
  '#': [
    [[7, 4], [7, 28]],
    [[13, 4], [13, 28]],
    [[3, 11], [17, 11]],
    [[3, 21], [17, 21]]
  ],
  $: [
    [[10, 2], [10, 30]],
    [[15, 7], [11, 4], [6, 7], [5, 11], [9, 14], [14, 18], [15, 23], [11, 27], [5, 25]]
  ],
  // Math Greek / Special symbols
  '~': [[[3, 15], [7, 11], [12, 18], [17, 14]]],
  // Arrows
  '->': [
    [[2, 16], [18, 16]],
    [[12, 10], [18, 16], [12, 22]]
  ],
  '<-': [
    [[2, 16], [18, 16]],
    [[8, 10], [2, 16], [8, 22]]
  ]
}

// ============================================================================
// 2. PRESSURE-SENSITIVE CURVE INTERPOLATOR
// Generates realistic natural human handwriting points with pressure z
// ============================================================================
function interpolateStroke(raw: RawStroke, scale = 1, jitter = true): Vec3[] {
  if (raw.length === 0) return []
  if (raw.length === 1) {
    return [{ x: raw[0][0] * scale, y: raw[0][1] * scale, z: 0.6 }]
  }

  const points: Vec3[] = []
  const stepsPerSegment = 6

  for (let i = 0; i < raw.length - 1; i++) {
    const p0 = raw[Math.max(0, i - 1)]
    const p1 = raw[i]
    const p2 = raw[i + 1]
    const p3 = raw[Math.min(raw.length - 1, i + 2)]

    for (let step = 0; step < stepsPerSegment; step++) {
      const t = step / stepsPerSegment
      const t2 = t * t
      const t3 = t2 * t

      // Catmull-Rom spline interpolation
      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)

      const y =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)

      // Downstroke produces heavier marker pressure
      const dy = p2[1] - p1[1]
      const downPressure = dy > 0 ? 0.72 : 0.48
      const entryExit = Math.sin(t * Math.PI) * 0.18
      const jx = jitter ? (Math.random() - 0.5) * 0.35 : 0
      const jy = jitter ? (Math.random() - 0.5) * 0.35 : 0

      const z = Math.min(0.9, Math.max(0.35, downPressure + entryExit))

      points.push({
        x: (x + jx) * scale,
        y: (y + jy) * scale,
        z
      })
    }
  }

  // End point
  const last = raw[raw.length - 1]
  points.push({ x: last[0] * scale, y: last[1] * scale, z: 0.4 })
  return points
}

// ============================================================================
// 3. HANDWRITTEN MARKER TEXT GENERATOR
// Converts text into tldraw draw shapes with pen strokes
// ============================================================================
export interface HandwritingOptions {
  color?: BoardColor
  size?: StrokeSize
  scale?: number
  slant?: number // horizontal slant in degrees
  lineSpacing?: number
  letterSpacing?: number
  underline?: boolean
}

export function createHandwrittenTextShapes(
  text: string,
  startX: number,
  startY: number,
  options: HandwritingOptions = {}
): TLShapePartial[] {
  const {
    color = 'black',
    size = 'm',
    scale = 1.4,
    slant = 4,
    lineSpacing = 52,
    letterSpacing = 16,
    underline = false
  } = options

  const shapes: TLShapePartial[] = []
  const lines = text.split('\n')

  let currentY = startY

  lines.forEach((line) => {
    let currentX = startX
    const lineMinX = currentX
    const segments: { type: 'free'; path: string }[] = []

    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const char = line[charIdx]

      if (char === ' ') {
        currentX += letterSpacing * 1.5 * scale
        continue
      }

      // Check 2-char tokens like '->' or '<-'
      const twoChar = line.slice(charIdx, charIdx + 2)
      let glyphKey = char
      let skipNext = false

      if (GLYPHS[twoChar]) {
        glyphKey = twoChar
        skipNext = true
      }

      const glyphStrokes = GLYPHS[glyphKey] || GLYPHS[char.toUpperCase()] || GLYPHS['?']

      if (glyphStrokes) {
        glyphStrokes.forEach((stroke) => {
          const rawPts = interpolateStroke(stroke, scale)
          // Offset to character position + slight italic slant
          const rad = (slant * Math.PI) / 180
          const offsetPts = rawPts.map((p) => ({
            x: currentX - startX + p.x + (30 * scale - p.y) * Math.tan(rad),
            y: currentY - startY + p.y,
            z: p.z
          }))

          if (offsetPts.length > 1) {
            segments.push({
              type: 'free',
              path: b64Vecs.encodePoints(offsetPts)
            })
          }
        })
      }

      currentX += (letterSpacing + 3) * scale
      if (skipNext) charIdx++
    }

    if (underline && currentX > lineMinX) {
      // Natural marker wavy underline
      const lineLen = currentX - lineMinX + 10 * scale
      const underlinePts: Vec3[] = []
      const samples = 12
      for (let s = 0; s <= samples; s++) {
        const t = s / samples
        const ux = lineMinX - startX + t * lineLen
        const uy = currentY - startY + 36 * scale + Math.sin(t * Math.PI * 2) * 1.8
        underlinePts.push({ x: ux, y: uy, z: 0.75 })
      }
      segments.push({
        type: 'free',
        path: b64Vecs.encodePoints(underlinePts)
      })
    }

    if (segments.length > 0) {
      shapes.push({
        id: createShapeId(),
        type: 'draw',
        x: startX,
        y: startY,
        props: {
          color: color as TLDefaultColorStyle,
          dash: 'draw',
          fill: 'none',
          isClosed: false,
          isComplete: true,
          isPen: true,
          scale: 1,
          scaleX: 1,
          scaleY: 1,
          segments,
          size: size as TLDefaultSizeStyle
        }
      } satisfies TLShapePartial)
    }

    currentY += lineSpacing * (scale / 1.2)
  })

  return shapes
}

// ============================================================================
// 4. RICH GEOMETRY & SHAPE DRAWING ENGINE
// Supports geometric shapes, markers, flowcharts, architectures, graphs,
// circuits, optical lenses, math formulas, and neural networks.
// ============================================================================
export interface ShapeSpec {
  id?: string
  geo?: TLGeoShapeGeoStyle
  x: number
  y: number
  w?: number
  h?: number
  label?: string
  color?: BoardColor
  fill?: 'none' | 'semi' | 'solid' | 'pattern'
  dash?: 'draw' | 'solid' | 'dashed' | 'dotted'
  size?: StrokeSize
}

export const createGeoShape = (spec: ShapeSpec): TLShapePartial => {
  const {
    geo = 'rectangle',
    x,
    y,
    w = 160,
    h = 80,
    label = '',
    color = 'green',
    fill = 'none',
    dash = 'draw',
    size = 'm'
  } = spec

  return {
    id: createShapeId(),
    type: 'geo',
    x,
    y,
    props: {
      color: color as TLDefaultColorStyle,
      dash,
      fill,
      font: 'draw',
      geo,
      h,
      labelColor: 'black' as TLDefaultColorStyle,
      richText: toRichText(label),
      size: size as TLDefaultSizeStyle,
      w
    }
  } satisfies TLShapePartial
}

export const createArrowShape = (
  x: number,
  y: number,
  endX: number,
  endY: number,
  label = '',
  color: BoardColor = 'green',
  dash: 'draw' | 'solid' | 'dashed' = 'draw'
): TLShapePartial => ({
  id: createShapeId(),
  type: 'arrow',
  x,
  y,
  props: {
    arrowheadEnd: 'arrow',
    arrowheadStart: 'none',
    color: color as TLDefaultColorStyle,
    dash,
    end: { x: endX, y: endY },
    richText: toRichText(label),
    size: 'm',
    start: { x: 0, y: 0 }
  }
})

export const createTextAnnotation = (
  text: string,
  x: number,
  y: number,
  w = 300,
  size: StrokeSize = 'm',
  color: BoardColor = 'black'
): TLShapePartial => ({
  id: createShapeId(),
  type: 'text',
  x,
  y,
  props: {
    autoSize: false,
    color: color as TLDefaultColorStyle,
    font: 'draw',
    richText: toRichText(text),
    scale: 1,
    size: size as TLDefaultSizeStyle,
    w
  }
})

// Freehand marker stroke shape (e.g. circle, box, star drawn by marker pen)
export function createMarkerPenShape(
  pts: [number, number][],
  startX: number,
  startY: number,
  color: BoardColor = 'green',
  size: StrokeSize = 'm'
): TLShapePartial {
  const interpolated = interpolateStroke(pts, 1, true)
  const encoded = b64Vecs.encodePoints(interpolated)

  return {
    id: createShapeId(),
    type: 'draw',
    x: startX,
    y: startY,
    props: {
      color: color as TLDefaultColorStyle,
      dash: 'draw',
      fill: 'none',
      isClosed: false,
      isComplete: true,
      isPen: true,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      segments: [{ type: 'free', path: encoded }],
      size: size as TLDefaultSizeStyle
    }
  }
}

// ============================================================================
// 5. EXTENSIVE DIAGRAM BUILDERS ("OVER ALL THE BEST ONE TYPE")
// ============================================================================

export function buildFlowchart(baseX: number, baseY: number): TLShapePartial[] {
  const shapes: TLShapePartial[] = []

  // Title in marker ink
  shapes.push(
    ...createHandwrittenTextShapes('FLOWCHART', baseX + 160, baseY, {
      color: 'green',
      scale: 1.5,
      underline: true
    })
  )

  // Start Node
  shapes.push(
    createGeoShape({
      geo: 'oval',
      x: baseX + 150,
      y: baseY + 60,
      w: 140,
      h: 60,
      label: 'START',
      color: 'green',
      fill: 'semi'
    })
  )

  // Arrow 1
  shapes.push(createArrowShape(baseX + 220, baseY + 120, 0, 50, '', 'green'))

  // Process 1
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: baseX + 130,
      y: baseY + 170,
      w: 180,
      h: 70,
      label: 'Init Parameters',
      color: 'blue'
    })
  )

  // Arrow 2
  shapes.push(createArrowShape(baseX + 220, baseY + 240, 0, 50, '', 'blue'))

  // Decision Diamond
  shapes.push(
    createGeoShape({
      geo: 'diamond',
      x: baseX + 130,
      y: baseY + 290,
      w: 180,
      h: 110,
      label: 'Valid Input?',
      color: 'orange',
      fill: 'semi'
    })
  )

  // Yes Branch (Down)
  shapes.push(createArrowShape(baseX + 220, baseY + 400, 0, 60, 'Yes', 'green'))

  // Process 2 (Success)
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: baseX + 130,
      y: baseY + 460,
      w: 180,
      h: 70,
      label: 'Execute Logic',
      color: 'green'
    })
  )

  // Arrow to End
  shapes.push(createArrowShape(baseX + 220, baseY + 530, 0, 50, '', 'green'))

  // End Node
  shapes.push(
    createGeoShape({
      geo: 'oval',
      x: baseX + 150,
      y: baseY + 580,
      w: 140,
      h: 60,
      label: 'SUCCESS',
      color: 'green',
      fill: 'semi'
    })
  )

  // No Branch (Right)
  shapes.push(createArrowShape(baseX + 310, baseY + 345, 110, 0, 'No', 'red'))

  // Error Handler Node
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: baseX + 420,
      y: baseY + 315,
      w: 150,
      h: 65,
      label: 'Raise Error',
      color: 'red'
    })
  )

  return shapes
}

export function buildArchitectureDiagram(baseX: number, baseY: number): TLShapePartial[] {
  const shapes: TLShapePartial[] = []

  shapes.push(
    ...createHandwrittenTextShapes('SYSTEM ARCHITECTURE', baseX + 100, baseY, {
      color: 'blue',
      scale: 1.5,
      underline: true
    })
  )

  // Client Node
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: baseX + 20,
      y: baseY + 70,
      w: 150,
      h: 80,
      label: 'Desktop App\n(Nexus Client)',
      color: 'blue',
      fill: 'semi'
    })
  )

  // Connector
  shapes.push(createArrowShape(baseX + 170, baseY + 110, 80, 0, 'WSS / IPC', 'blue'))

  // API Gateway / Edge
  shapes.push(
    createGeoShape({
      geo: 'cloud',
      x: baseX + 250,
      y: baseY + 50,
      w: 180,
      h: 120,
      label: 'Cloudflare\nEdge Gateway',
      color: 'orange',
      fill: 'semi'
    })
  )

  // Connectors to Workers
  shapes.push(createArrowShape(baseX + 430, baseY + 90, 80, -40, 'RPC', 'green'))
  shapes.push(createArrowShape(baseX + 430, baseY + 130, 80, 40, 'Tunnel', 'violet'))

  // Service 1 (AI Autonomous Engine)
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: baseX + 510,
      y: baseY + 30,
      w: 160,
      h: 70,
      label: 'Autonomous\nAgent Core',
      color: 'green'
    })
  )

  // Service 2 (Storage & Vault)
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: baseX + 510,
      y: baseY + 140,
      w: 160,
      h: 70,
      label: 'Encrypted\nLocal Store',
      color: 'violet'
    })
  )

  // Database Cylinder
  shapes.push(
    createGeoShape({
      geo: 'rhombus',
      x: baseX + 710,
      y: baseY + 80,
      w: 140,
      h: 90,
      label: 'SQLite (WAL)\nDPAPI Secured',
      color: 'grey',
      fill: 'solid'
    })
  )

  shapes.push(createArrowShape(baseX + 670, baseY + 65, 40, 30, '', 'grey'))
  shapes.push(createArrowShape(baseX + 670, baseY + 175, 40, -30, '', 'grey'))

  return shapes
}

export function buildNeuralNetworkDiagram(baseX: number, baseY: number): TLShapePartial[] {
  const shapes: TLShapePartial[] = []

  shapes.push(
    ...createHandwrittenTextShapes('NEURAL NETWORK', baseX + 130, baseY, {
      color: 'violet',
      scale: 1.5,
      underline: true
    })
  )

  const inputYs = [70, 140, 210]
  const hiddenYs = [50, 110, 170, 230]
  const outputYs = [110, 170]

  const inputX = baseX + 40
  const hiddenX = baseX + 260
  const outputX = baseX + 480

  // Input Nodes
  inputYs.forEach((y, i) => {
    shapes.push(
      createGeoShape({
        geo: 'ellipse',
        x: inputX,
        y: baseY + y,
        w: 50,
        h: 50,
        label: `x${i + 1}`,
        color: 'blue',
        fill: 'semi'
      })
    )
  })

  // Hidden Nodes
  hiddenYs.forEach((y, i) => {
    shapes.push(
      createGeoShape({
        geo: 'ellipse',
        x: hiddenX,
        y: baseY + y,
        w: 50,
        h: 50,
        label: `h${i + 1}`,
        color: 'violet',
        fill: 'semi'
      })
    )
  })

  // Output Nodes
  outputYs.forEach((y, i) => {
    shapes.push(
      createGeoShape({
        geo: 'ellipse',
        x: outputX,
        y: baseY + y,
        w: 50,
        h: 50,
        label: `y${i + 1}`,
        color: 'green',
        fill: 'semi'
      })
    )
  })

  // Synaptic Connections (Arrows)
  inputYs.forEach((iy) => {
    hiddenYs.forEach((hy) => {
      shapes.push(
        createArrowShape(inputX + 50, baseY + iy + 25, hiddenX - (inputX + 50), hy - iy, '', 'blue', 'dashed')
      )
    })
  })

  hiddenYs.forEach((hy) => {
    outputYs.forEach((oy) => {
      shapes.push(
        createArrowShape(hiddenX + 50, baseY + hy + 25, outputX - (hiddenX + 50), oy - hy, '', 'violet')
      )
    })
  })

  // Labels
  shapes.push(createTextAnnotation('Input Layer', inputX - 15, baseY + 280, 100, 's', 'blue'))
  shapes.push(createTextAnnotation('Hidden Layer', hiddenX - 15, baseY + 295, 110, 's', 'violet'))
  shapes.push(createTextAnnotation('Output Layer', outputX - 15, baseY + 240, 100, 's', 'green'))

  return shapes
}

export function buildCoordinateGraph(baseX: number, baseY: number): TLShapePartial[] {
  const shapes: TLShapePartial[] = []

  shapes.push(
    ...createHandwrittenTextShapes('y = sin(x) & y = x^2', baseX + 80, baseY, {
      color: 'blue',
      scale: 1.4,
      underline: true
    })
  )

  const ox = baseX + 80
  const oy = baseY + 200

  // Y Axis (up)
  shapes.push(createArrowShape(ox, oy, 0, -180, 'Y', 'black'))
  // X Axis (right)
  shapes.push(createArrowShape(ox, oy, 380, 0, 'X', 'black'))

  // Ticks on X
  for (let t = 1; t <= 5; t++) {
    const tx = ox + t * 65
    shapes.push(createArrowShape(tx, oy - 5, 0, 10, '', 'black', 'solid'))
    shapes.push(createTextAnnotation(`${t}`, tx - 5, oy + 8, 30, 's', 'black'))
  }

  // Sine Wave in marker strokes
  const sinePts: [number, number][] = []
  for (let x = 0; x <= 360; x += 15) {
    const rad = (x * Math.PI) / 90
    const y = -Math.sin(rad) * 60
    sinePts.push([ox + x, oy + y])
  }
  shapes.push(createMarkerPenShape(sinePts, 0, 0, 'blue', 'm'))
  shapes.push(createTextAnnotation('sin(x)', ox + 320, oy - 75, 80, 's', 'blue'))

  // Parabola in red marker strokes
  const paraPts: [number, number][] = []
  for (let x = 0; x <= 160; x += 10) {
    const norm = x / 80
    const y = -Math.min(170, norm * norm * 45)
    paraPts.push([ox + x, oy + y])
  }
  shapes.push(createMarkerPenShape(paraPts, 0, 0, 'red', 'm'))
  shapes.push(createTextAnnotation('x²', ox + 140, oy - 155, 60, 's', 'red'))

  return shapes
}

export function buildOpticsLensDiagram(baseX: number, baseY: number): TLShapePartial[] {
  const shapes: TLShapePartial[] = []

  shapes.push(
    ...createHandwrittenTextShapes('CONVEX LENS RAY TRACING', baseX + 80, baseY, {
      color: 'blue',
      scale: 1.4,
      underline: true
    })
  )

  const lensX = baseX + 280
  const lensY = baseY + 60

  // Convex Lens
  shapes.push(
    createGeoShape({
      geo: 'ellipse',
      x: lensX,
      y: lensY,
      w: 48,
      h: 240,
      label: 'Convex Lens',
      color: 'blue',
      fill: 'semi'
    })
  )

  // Principal Axis
  shapes.push(createArrowShape(baseX + 10, lensY + 120, 600, 0, '', 'black', 'dashed'))
  shapes.push(createTextAnnotation('Principal Axis', baseX + 450, lensY + 130, 150, 's', 'black'))

  // Focal Points F and 2F
  shapes.push(createGeoShape({ geo: 'ellipse', x: lensX - 120, y: lensY + 116, w: 8, h: 8, label: 'F', color: 'red' }))
  shapes.push(createGeoShape({ geo: 'ellipse', x: lensX + 120, y: lensY + 116, w: 8, h: 8, label: "F'", color: 'red' }))

  // Object Arrow (left)
  shapes.push(createArrowShape(lensX - 200, lensY + 120, 0, -80, 'Object', 'green'))

  // Ray 1: Parallel then through focus
  shapes.push(createArrowShape(lensX - 200, lensY + 40, 200, 0, '', 'orange'))
  shapes.push(createArrowShape(lensX + 24, lensY + 40, 280, 140, '', 'orange'))

  // Ray 2: Through optical center
  shapes.push(createArrowShape(lensX - 200, lensY + 40, 480, 160, '', 'violet'))

  // Inverted Real Image
  shapes.push(createArrowShape(lensX + 190, lensY + 120, 0, 70, 'Image', 'red'))

  return shapes
}

export function buildElectricCircuitDiagram(baseX: number, baseY: number): TLShapePartial[] {
  const shapes: TLShapePartial[] = []

  shapes.push(
    ...createHandwrittenTextShapes('DC CIRCUIT: V = I * R', baseX + 100, baseY, {
      color: 'green',
      scale: 1.4,
      underline: true
    })
  )

  const ox = baseX + 60
  const oy = baseY + 80

  // Top wire with Resistor
  shapes.push(createArrowShape(ox, oy, 140, 0, '', 'black', 'solid'))
  // Resistor Box
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: ox + 140,
      y: oy - 15,
      w: 120,
      h: 30,
      label: 'R = 100 Ω',
      color: 'orange',
      fill: 'semi'
    })
  )
  shapes.push(createArrowShape(ox + 260, oy, 140, 0, '', 'black', 'solid'))

  // Right wire down
  shapes.push(createArrowShape(ox + 400, oy, 0, 160, '', 'black', 'solid'))

  // Bottom wire with Switch
  shapes.push(createArrowShape(ox + 400, oy + 160, -160, 0, '', 'black', 'solid'))
  // Switch
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: ox + 180,
      y: oy + 145,
      w: 60,
      h: 30,
      label: 'SW 1',
      color: 'blue'
    })
  )
  shapes.push(createArrowShape(ox + 180, oy + 160, -120, 0, '', 'black', 'solid'))

  // Left wire with DC Battery
  shapes.push(createArrowShape(ox, oy + 160, 0, -50, '', 'black', 'solid'))
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: ox - 20,
      y: oy + 60,
      w: 40,
      h: 50,
      label: '+12V',
      color: 'green',
      fill: 'solid'
    })
  )
  shapes.push(createArrowShape(ox, oy + 60, 0, -60, '', 'black', 'solid'))

  // Current arrow
  shapes.push(createArrowShape(ox + 60, oy - 20, 50, 0, 'I = 0.12 A', 'red'))

  return shapes
}

export function buildPythagoreanGeometry(baseX: number, baseY: number): TLShapePartial[] {
  const shapes: TLShapePartial[] = []

  shapes.push(
    ...createHandwrittenTextShapes('PYTHAGOREAN THEOREM', baseX + 60, baseY, {
      color: 'blue',
      scale: 1.4,
      underline: true
    })
  )

  const ox = baseX + 80
  const oy = baseY + 260
  const baseLen = 220
  const heightLen = 160

  // Right triangle
  shapes.push(
    createGeoShape({
      geo: 'triangle',
      x: ox,
      y: oy - heightLen,
      w: baseLen,
      h: heightLen,
      label: '',
      color: 'blue',
      fill: 'semi'
    })
  )

  // Labels for sides
  shapes.push(createTextAnnotation('a = 3', ox - 50, oy - 90, 60, 'm', 'orange'))
  shapes.push(createTextAnnotation('b = 4', ox + 90, oy + 15, 60, 'm', 'orange'))
  shapes.push(createTextAnnotation('c = 5', ox + 120, oy - 110, 60, 'm', 'green'))

  // 90 deg marker
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: ox,
      y: oy - 20,
      w: 20,
      h: 20,
      label: '',
      color: 'black'
    })
  )

  // Formula in marker handwriting
  shapes.push(
    ...createHandwrittenTextShapes('a² + b² = c²', ox + 260, baseY + 90, {
      color: 'green',
      scale: 1.3,
      underline: true
    })
  )
  shapes.push(
    ...createHandwrittenTextShapes('9 + 16 = 25', ox + 260, baseY + 150, {
      color: 'black',
      scale: 1.1
    })
  )

  return shapes
}

export function buildChemistryBenzene(baseX: number, baseY: number): TLShapePartial[] {
  const shapes: TLShapePartial[] = []

  shapes.push(
    ...createHandwrittenTextShapes('BENZENE (C6H6)', baseX + 100, baseY, {
      color: 'violet',
      scale: 1.4,
      underline: true
    })
  )

  // Hexagon ring
  shapes.push(
    createGeoShape({
      geo: 'hexagon',
      x: baseX + 120,
      y: baseY + 70,
      w: 160,
      h: 180,
      label: '',
      color: 'violet',
      fill: 'none',
      size: 'l'
    })
  )

  // Internal resonant circle
  shapes.push(
    createGeoShape({
      geo: 'ellipse',
      x: baseX + 155,
      y: baseY + 115,
      w: 90,
      h: 90,
      label: 'Delocalized π',
      color: 'violet',
      dash: 'dashed'
    })
  )

  // Chemical info
  shapes.push(
    ...createHandwrittenTextShapes('Aromatic Ring', baseX + 320, baseY + 100, {
      color: 'black',
      scale: 1.1
    })
  )
  shapes.push(
    ...createHandwrittenTextShapes('sp2 hybridized', baseX + 320, baseY + 140, {
      color: 'green',
      scale: 1.0
    })
  )

  return shapes
}

export function buildMindMap(baseX: number, baseY: number): TLShapePartial[] {
  const shapes: TLShapePartial[] = []

  const cx = baseX + 260
  const cy = baseY + 180

  // Central Core Idea
  shapes.push(
    createGeoShape({
      geo: 'ellipse',
      x: cx - 90,
      y: cy - 45,
      w: 180,
      h: 90,
      label: 'CORE CONCEPT',
      color: 'green',
      fill: 'solid',
      size: 'l'
    })
  )

  // Branch 1 (Top Right)
  shapes.push(createArrowShape(cx + 90, cy - 20, 110, -70, '', 'blue'))
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: cx + 200,
      y: cy - 120,
      w: 140,
      h: 60,
      label: 'Architecture',
      color: 'blue'
    })
  )

  // Branch 2 (Bottom Right)
  shapes.push(createArrowShape(cx + 90, cy + 20, 110, 70, '', 'violet'))
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: cx + 200,
      y: cy + 70,
      w: 140,
      h: 60,
      label: 'Performance',
      color: 'violet'
    })
  )

  // Branch 3 (Left)
  shapes.push(createArrowShape(cx - 90, cy, -110, 0, '', 'orange'))
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: cx - 340,
      y: cy - 30,
      w: 140,
      h: 60,
      label: 'Security & Auth',
      color: 'orange'
    })
  )

  return shapes
}

// ============================================================================
// 6. MASTER COMPOSER: RESOLVES PROMPTS AND GENERATES COMPLETE BOARD OBJECTS
// ============================================================================
export interface WhiteboardComposition {
  title: string
  shapes: TLShapePartial[]
  mode: 'marker_ink' | 'diagram' | 'hybrid' | 'text'
}

export function composeWhiteboardElements(
  prompt: string,
  content = '',
  preferredMode: 'marker_ink' | 'diagram' | 'hybrid' | 'text' = 'hybrid',
  preferredColor: BoardColor = 'green'
): WhiteboardComposition {
  const fullText = [prompt, content].filter(Boolean).join('\n')
  const lower = fullText.toLowerCase()
  const shapes: TLShapePartial[] = []

  const title = (prompt || content.split('\n')[0] || 'Whiteboard').trim()

  // 1. Check for specific diagram keywords
  let diagramKind = ''
  if (/lens|optics|ray|refract/i.test(lower)) diagramKind = 'lens'
  else if (/flowchart|flow|process|decision/i.test(lower)) diagramKind = 'flow'
  else if (/architecture|system|gateway|microservice/i.test(lower)) diagramKind = 'architecture'
  else if (/neural|network|deep learning|synapse/i.test(lower)) diagramKind = 'neural'
  else if (/graph|sin|cosine|parabola|plot|coordinate|axis/i.test(lower)) diagramKind = 'graph'
  else if (/circuit|resistor|battery|voltage|ohm/i.test(lower)) diagramKind = 'circuit'
  else if (/triangle|pythagor|geometry|hypotenuse/i.test(lower)) diagramKind = 'geometry'
  else if (/benzene|chemistry|molecule|atom/i.test(lower)) diagramKind = 'chemistry'
  else if (/mindmap|mind map|brainstorm/i.test(lower)) diagramKind = 'mindmap'

  // If specific diagram detected, generate rich diagram
  if (diagramKind) {
    let diagramShapes: TLShapePartial[] = []
    switch (diagramKind) {
      case 'lens':
        diagramShapes = buildOpticsLensDiagram(80, 70)
        break
      case 'flow':
        diagramShapes = buildFlowchart(80, 70)
        break
      case 'architecture':
        diagramShapes = buildArchitectureDiagram(60, 70)
        break
      case 'neural':
        diagramShapes = buildNeuralNetworkDiagram(60, 70)
        break
      case 'graph':
        diagramShapes = buildCoordinateGraph(80, 70)
        break
      case 'circuit':
        diagramShapes = buildElectricCircuitDiagram(80, 70)
        break
      case 'geometry':
        diagramShapes = buildPythagoreanGeometry(80, 70)
        break
      case 'chemistry':
        diagramShapes = buildChemistryBenzene(80, 70)
        break
      case 'mindmap':
        diagramShapes = buildMindMap(80, 70)
        break
    }
    return {
      title,
      shapes: diagramShapes,
      mode: 'diagram'
    }
  }

  // 2. Check for explicit marker handwriting preference
  const isHandwritingExplicit =
    preferredMode === 'marker_ink' ||
    /handwriting|marker|pen|cursive|write like a marker|ink/i.test(lower)

  if (isHandwritingExplicit) {
    // Pure Marker Pen Handwriting
    const displayLines = content
      ? content.replace(/```[\s\S]*?```/g, '').trim()
      : prompt

    // Header in bold marker ink
    shapes.push(
      ...createHandwrittenTextShapes(title, 80, 60, {
        color: preferredColor,
        scale: 1.6,
        underline: true
      })
    )

    // Body in marker ink
    shapes.push(
      ...createHandwrittenTextShapes(displayLines, 80, 150, {
        color: 'black',
        scale: 1.25,
        lineSpacing: 50
      })
    )

    return {
      title,
      shapes,
      mode: 'marker_ink'
    }
  }

  // 3. Default: Top-Tier Hybrid Whiteboard Solution
  // Header in real marker ink
  shapes.push(
    ...createHandwrittenTextShapes(title, 80, 60, {
      color: preferredColor,
      scale: 1.5,
      underline: true
    })
  )

  // Step-by-step content parsing
  const rawLines = (content || prompt)
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  let y = 160
  rawLines.slice(0, 10).forEach((line, index) => {
    const isFormula = /[$=+]/.test(line) || /\^|\_/.test(line)

    if (isFormula) {
      // Formulas written in beautiful marker handwriting
      shapes.push(
        ...createHandwrittenTextShapes(line.replace(/\$/g, ''), 95, y, {
          color: 'blue',
          scale: 1.2
        })
      )
      y += 65
    } else {
      // Step cards with geo bullet and text
      shapes.push(
        createGeoShape({
          geo: 'rectangle',
          x: 70,
          y: y - 5,
          w: 30,
          h: 30,
          label: `${index + 1}`,
          color: preferredColor,
          fill: 'semi',
          size: 's'
        })
      )
      shapes.push(createTextAnnotation(line, 115, y, 780, 'm', 'black'))
      y += line.length > 80 ? 70 : 50
    }
  })

  // Final Highlight / Boxed Result
  shapes.push(
    createGeoShape({
      geo: 'rectangle',
      x: 70,
      y: y + 20,
      w: 680,
      h: 80,
      label: '✓ Result Verified & Solved',
      color: 'green',
      fill: 'semi',
      size: 'm'
    })
  )

  return {
    title,
    shapes,
    mode: 'hybrid'
  }
}
