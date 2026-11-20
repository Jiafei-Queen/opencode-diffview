export async function run(command: readonly string[], options: { cwd: string; signal?: AbortSignal }) {
  options.signal?.throwIfAborted()
  const process = Bun.spawn([...command], {
    cwd: options.cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  })
  const abort = () => process.kill()
  options.signal?.addEventListener("abort", abort, { once: true })
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ])
    options.signal?.throwIfAborted()
    if (code !== 0) throw new Error(stderr.trim() || `${command[0]} exited with code ${code}`)
    return stdout
  } finally {
    options.signal?.removeEventListener("abort", abort)
  }
}
