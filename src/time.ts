// The platform counts unix SECONDS; JavaScript counts milliseconds.

export const now = (): number => Math.floor(Date.now() / 1000)

const DAY = 86400

/** "12 Mar 2026, 14:30"; empty for an unset time. */
export function at(seconds: number): string {
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "in 3 hours", "2 days ago". */
export function since(seconds: number): string {
  if (!seconds) return ''
  const gap = seconds - now()
  const size = Math.abs(gap)
  const [count, unit] =
    size < 3600
      ? [Math.max(1, Math.round(size / 60)), 'minute']
      : size < DAY
        ? [Math.round(size / 3600), 'hour']
        : size < DAY * 30
          ? [Math.round(size / DAY), 'day']
          : [Math.round(size / (DAY * 30)), 'month']
  const word = `${count} ${unit}${count === 1 ? '' : 's'}`
  return gap > 0 ? `in ${word}` : `${word} ago`
}

/** A step's wait, in the largest whole unit. */
export function delay(seconds: number, first: boolean): string {
  const from = first ? 'enrollment' : 'the previous step'
  if (!seconds) return `Sends right after ${from}`
  const [n, unit] =
    seconds % DAY === 0
      ? [seconds / DAY, 'day']
      : seconds % 3600 === 0
        ? [seconds / 3600, 'hour']
        : [Math.round(seconds / 60), 'minute']
  return `Sends ${n} ${unit}${n === 1 ? '' : 's'} after ${from}`
}

/** To and from a `datetime-local` value, which is local wall-clock time. */
export function toField(seconds: number): string {
  if (!seconds) return ''
  const d = new Date(seconds * 1000)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function fromField(value: string): number {
  const ms = value ? new Date(value).getTime() : NaN
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000)
}
