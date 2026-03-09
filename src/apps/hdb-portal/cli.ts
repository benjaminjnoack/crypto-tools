import { primeEnv } from "#shared/common/index";
import { startPortalServer } from "./server.js";

async function main() {
  primeEnv();

  const portRaw = process.env.HELPER_HDB_PORTAL_PORT;
  const host = process.env.HELPER_HDB_PORTAL_HOST ?? "127.0.0.1";
  const port = portRaw ? Number.parseInt(portRaw, 10) : 43110;

  if (!Number.isFinite(port)) {
    throw new Error(`Invalid HELPER_HDB_PORTAL_PORT: ${portRaw}`);
  }

  const { host: boundHost, port: boundPort } = await startPortalServer({ host, port });
  console.log(`hdb portal running at http://${boundHost}:${boundPort}`);
  console.log("Read-only mode: the portal does not run rebuild/import/live Coinbase actions.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
