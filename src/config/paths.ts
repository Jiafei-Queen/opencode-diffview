import path from "node:path"
import { homedir } from "node:os"

function xdgRoot(override: string | undefined, base: string, home: string, directory: string) {
  return override ? path.resolve(override) : path.join(base || path.join(home, directory), "ocdiff")
}

/** Root of machine-managed state such as saved reviews. */
export function stateRoot(env: NodeJS.ProcessEnv = process.env, home = homedir()) {
  return xdgRoot(env.OCDIFF_STATE_HOME, env.XDG_STATE_HOME ?? "", home, ".local/state")
}

export function snapshotsDirectory(env?: NodeJS.ProcessEnv, home?: string) {
  return path.join(stateRoot(env, home), "saved")
}

/** Root of human-editable configuration. */
export function configRoot(env: NodeJS.ProcessEnv = process.env, home = homedir()) {
  return xdgRoot(env.OCDIFF_CONFIG_HOME, env.XDG_CONFIG_HOME ?? "", home, ".config")
}

export function settingsFile(env?: NodeJS.ProcessEnv, home?: string) {
  return path.join(configRoot(env, home), "config.json")
}
