// Three detuned sine waves on each axis produce an irregular tumble that
// reads as drag/wind resistance — used by the hook in flight and reeled
// back. Centralising the formula keeps both phases visually consistent.

export interface Wobble {
  x: number
  y: number
  z: number
}

// `t` is seconds since the wobble started; `freq` is the base oscillation
// rate; `amplitudeDeg` is the peak deflection per axis. Pass `scale=1` for
// flight, smaller values for reduced-amplitude states (e.g. reeling).
export function computeWobble(
  t: number,
  freq: number,
  amplitudeDeg: number,
  scale: number = 1
): Wobble {
  const a = amplitudeDeg * scale
  return {
    x: Math.sin(t * freq) * a,
    y: Math.sin(t * freq * 1.31 + 1.7) * a * 0.7,
    z: Math.sin(t * freq * 0.79 + 0.5) * a * 1.1
  }
}
