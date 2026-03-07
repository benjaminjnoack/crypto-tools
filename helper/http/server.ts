import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  handleAskRequest,
  handleBreakRequest,
  handleCancelRequest,
  handleClearRequest,
  handleExecRequest,
  handleFillsRequest,
  handleFireRequest,
  handleModifyRequest,
  handleOpenRequest,
  handlePrepRequest,
  handleSaveRequest,
  handleScheduleRequest,
  handleSellRequest,
  handleStateRequest,
  handleStatusRequest,
  handleTakeProfitRequest,
  handleTrailRequest,
} from './resources.js';
import { env } from '@boot/env';
const E = env();
import { randomUUID } from 'node:crypto';
import { withOperation, log } from '@core/logger.js';

function notFound(res: ServerResponse) {
  // If the route or method doesn't match
  log.error(`server => 404`);
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      status: 'error',
      message: 'Endpoint not found',
    }),
  );
}

function serverError(e: Error, res: ServerResponse) {
  log.error(`server => 500 ${e.message || e}`);
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      status: 'error',
      message: e.message || e,
      stack: e.stack,
    }),
  );
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const reqId = randomUUID();

  withOperation(
    { reqId, surface: 'http', path: req.url, method: req.method },
    async (): Promise<null | undefined> => {
      log.info(`server => ${req.method} ${req.url}`);
      // Guard: req.url may be undefined
      if (!req.url) return null;

      // Build an absolute URL for parsing (Node’s URL needs a base)
      const base = `https://${req.headers.host ?? 'localhost'}`;
      try {
        const u = new URL(req.url, base);
        switch (u.pathname) {
          case '/ask':
            await handleAskRequest(req, res);
            break;
          case '/break':
            await handleBreakRequest(req, res);
            break;
          case '/cancel':
            await handleCancelRequest(req, res);
            break;
          case '/clear':
            await handleClearRequest(req, res);
            break;
          case '/exec':
            await handleExecRequest(req, res);
            break;
          case '/fills':
            await handleFillsRequest(req, res);
            break;
          case '/fire':
            await handleFireRequest(req, res);
            break;
          case '/modify':
            await handleModifyRequest(req, res);
            break;
          case '/open':
            await handleOpenRequest(req, res);
            break;
          case '/prep':
            await handlePrepRequest(req, res);
            break;
          case '/save':
            await handleSaveRequest(req, res);
            break;
          case '/schedule':
            await handleScheduleRequest(req, res);
            break;
          case '/sell':
            await handleSellRequest(req, res);
            break;
          case '/state':
            await handleStateRequest(req, res);
            break;
          case '/status':
            await handleStatusRequest(req, res);
            break;
          case '/tp':
            await handleTakeProfitRequest(req, res);
            break;
          case '/trail':
            await handleTrailRequest(req, res);
            break;
          default:
            notFound(res);
            break;
        }
      } catch (e) {
        log.error(`server => ${e instanceof Error ? e.message : e}`);
        serverError(e as Error, res);
      }

      return null;
    },
  );
}

const server = createServer(handleRequest);

async function startServer() {
  return new Promise<void>((resolve) => {
    server.listen(E.HELPER_PORT, () => {
      log.debug(`Server is running on http://localhost:${E.HELPER_PORT}`);
      resolve();
    });
  });
}

export default startServer;
