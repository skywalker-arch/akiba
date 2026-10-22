export function normalizeOrigin(rawOrigin: string): string {
  const value = rawOrigin.trim();

  if (!value) {
    return "";
  }

  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

export function parseOrigins(value: string | undefined): string[] {
  const defaultPorts = [3000, 3001, 4173, 5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];
  const defaults = defaultPorts.flatMap((port) => [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `http://0.0.0.0:${port}`,
    `http://[::1]:${port}`,
  ]);

  const configuredOrigins = (value ?? defaults.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const seen = new Set<string>();

  for (const rawOrigin of configuredOrigins) {
    const normalized = normalizeOrigin(rawOrigin);
    if (!normalized) {
      continue;
    }

    seen.add(normalized);

    try {
      const url = new URL(normalized);
      const host = url.hostname.toLowerCase();
      const port = url.port ? `:${url.port}` : "";
      const protocol = url.protocol;

      if (host === "localhost") {
        seen.add(`${protocol}//127.0.0.1${port}`);
        seen.add(`${protocol}//0.0.0.0${port}`);
      }

      if (["127.0.0.1", "0.0.0.0"].includes(host)) {
        seen.add(`${protocol}//localhost${port}`);
      }

      if (["::1", "[::1]"].includes(host)) {
        seen.add(`${protocol}//localhost${port}`);
      }
    } catch {
      // ignore malformed/custom origins and keep the raw normalized value
    }
  }

  return [...seen];
}
