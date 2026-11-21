export function formatTimestamp(input: string | Date) {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return String(input)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

export function defaultSnapshotName(cwd: string, source: string, now = new Date()) {
  const parts = cwd.split(/[\\/]/).filter(Boolean)
  const repository = parts.at(-1) ?? "diff"
  return `${repository} · ${source} · ${formatTimestamp(now)}`
}
