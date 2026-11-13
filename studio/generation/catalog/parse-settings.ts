import type { ModelEntry } from "./types"

export function parseSettings(
  model: ModelEntry,
  raw: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(model.settings)) {
    const value = raw[key]
    if (field.type === "enum") {
      const picked = typeof value === "string" ? value : field.default
      if (!field.values.includes(picked)) throw new Error(`Invalid ${key}`)
      out[key] = picked
      continue
    }
    if (field.type === "range") {
      const picked = typeof value === "number" ? value : field.default
      const steps = (picked - field.min) / (field.step ?? 1)
      if (
        picked < field.min ||
        picked > field.max ||
        Math.abs(steps - Math.round(steps)) > 1e-9
      )
        throw new Error(`Invalid ${key}`)
      out[key] = picked
      continue
    }
    out[key] = typeof value === "boolean" ? value : field.default
  }
  return out
}
