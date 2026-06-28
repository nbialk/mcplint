/** npm registry lookup helpers for the optional update check on --version. */

const REGISTRY_TIMEOUT_MS = 2000;

/** Skip the update check in CI or when the user opted out. */
export function shouldCheck(): boolean {
  return !process.env.CI && !process.env.NO_UPDATE_NOTIFIER;
}

/**
 * Fetch the latest published version from the npm registry. Returns null on any
 * failure (offline, timeout, non-200) so the caller can skip silently.
 */
export async function getLatestVersion(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://registry.npmjs.org/${name}/latest`,
      { signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}

/** True when `latest` is a strictly higher release than `current`. */
export function isOutdated(current: string, latest: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(latest);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    const cur = a[i] ?? 0;
    const next = b[i] ?? 0;
    if (next > cur) return true;
    if (next < cur) return false;
  }
  return false;
}

/** Parse the numeric major.minor.patch core, ignoring any pre-release suffix. */
function parseVersion(value: string): [number, number, number] | null {
  const core = value.trim().split(/[-+]/, 1)[0] ?? "";
  const parts = core.split(".");
  if (parts.length !== 3) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0)) return null;
  return [nums[0]!, nums[1]!, nums[2]!];
}
