import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"

/** Returns undefined for a missing, unreadable, or malformed JSON file. */
export async function readJsonFile(file: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8"))
  } catch {
    return undefined
  }
}

export async function writeJsonFile(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
  const temporary = `${file}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, undefined, 2)}\n`, { mode: 0o600 })
  try {
    await rename(temporary, file)
  } catch {
    // Windows does not replace an existing target with rename.
    await rm(file, { force: true })
    await rename(temporary, file)
  }
}
