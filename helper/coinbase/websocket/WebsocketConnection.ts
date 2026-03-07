import { EventEmitter } from 'node:events';
import WebSocket, { type RawData } from 'ws';
import { log } from '@core/logger.js';
import { getSigningKeys, hasSigningKeys, signWithJWT } from '../signing.js';
import { CHANNEL_NAMES } from '@core/dictionary';
import { env } from '@boot/env';
import { type WebSocketData, WebSocketDataSchema } from '@cb/websocket/contracts';
const E = env();

const HELPER_WATCHDOG = !!E.HELPER_WATCHDOG;
if (HELPER_WATCHDOG) {
  log.info(`Websocket watchdog is ENABLED`);
} else {
  log.warn(`Websocket watchdog is DISABLED`);
}

const WS_API_URL = 'wss://advanced-trade-ws.coinbase.com';

export class WebsocketConnection extends EventEmitter {
  public readonly id: string;

  ws: WebSocket | null = null;
  sequence_number: number = 0;

  watchdogTimeout: number = 10_000; // 10 seconds
  watchdogTimer: NodeJS.Timeout | undefined = undefined;

  constructor(id: string) {
    super();
    this.id = id;
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  async connect() {
    if (!hasSigningKeys()) {
      await getSigningKeys();
    }

    const ws = new WebSocket(WS_API_URL);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        log.info(`${this.id} WebSocket open`);
        cleanupEarly();
        // attach long-lived handlers only after we are "open"
        this.attachLongLivedHandlers(ws);
        this.kickWatchdog();

        // Subscribe to heartbeats to keep the connection open
        const message = {
          type: 'subscribe',
          channel: CHANNEL_NAMES.heartbeats,
        };
        const subscribeMsg = signWithJWT(message);
        this.send(subscribeMsg);

        resolve();
      };

      const onError = (err: Error) => {
        cleanupEarly();
        reject(err);
      };

      let timeout: NodeJS.Timeout | null = null;
      const timeoutMs = 15_000;
      if (timeoutMs > 0) {
        timeout = setTimeout(() => {
          cleanupEarly();
          try {
            ws.terminate();
          } catch {}
          reject(new Error(`WebSocket connect timeout after ${timeoutMs} ms`));
        }, timeoutMs);
      }

      const cleanupEarly = () => {
        ws.off('open', onOpen);
        ws.off('error', onError);
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
      };

      ws.once('open', onOpen);
      ws.once('error', onError);
    });
  }

  /**
   * Send a JSON-serializable payload.
   */
  send(obj: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    const payload = JSON.stringify(obj);
    this.ws.send(payload);
  }

  /**
   * Close the connection intentionally.
   */
  close(code?: number, reason?: string): void {
    if (this.ws) {
      this.detachLongLivedHandlers(this.ws);
      try {
        this.ws.close(code, reason);
      } catch {}
      this.ws = null;
    }
    this.clearWatchdog();
  }

  // --- internals ---

  private attachLongLivedHandlers(ws: WebSocket): void {
    ws.on('message', this.onMessage);
    ws.on('error', this.onSocketError);
    ws.on('close', this.onClose);

    // If the server supports ping/pong, this helps keep the connection alive.
    ws.on('pong', this.onPong);

    // Start a ping loop (optional; many servers expect it)
    // You can also use setInterval; keeping it simple here with the watchdog.
    this.kickWatchdog();
  }

  private detachLongLivedHandlers(ws: WebSocket): void {
    ws.off('message', this.onMessage);
    ws.off('error', this.onSocketError);
    ws.off('close', this.onClose);
    ws.off('pong', this.onPong);
    this.clearWatchdog();
  }

  private onMessage = (data: RawData) => {
    try {
      const dataString = data.toString();
      const dataJSON = JSON.parse(dataString);
      const parsed: WebSocketData = WebSocketDataSchema.parse(dataJSON);

      if (parsed.sequence_num < this.sequence_number) {
        return;
      }

      this.sequence_number = parsed.sequence_num;

      if (parsed.channel === CHANNEL_NAMES.heartbeats) {
        this.kickWatchdog();
      } else {
        this.emit(parsed.channel, parsed.events);
      }
    } catch (error) {
      log.error(
        `${this.id} Error processing message: ${error instanceof Error ? error.message : error}`,
      );
    }
  };

  private onSocketError = (err: Error) => {
    this.emit('error', err);
    // You may choose to NOT close here and let 'close' event happen naturally.
  };

  private onClose = (code: number, reason: Buffer) => {
    this.emit('close', code, reason.toString());
    this.clearWatchdog();
    // Optional: schedule reconnect here
    // setTimeout(() => void this.connect(…)), backoff, etc.
  };

  private onPong = () => {
    this.kickWatchdog();
  };

  // --- watchdog/ping ---

  private kickWatchdog(): void {
    if (!HELPER_WATCHDOG) {
      return; //no-op
    }
    this.clearWatchdog();

    // Send a ping periodically; if no 'pong' or message resets us, treat as dead.
    this.watchdogTimer = setTimeout(() => {
      if (!this.ws) return;
      try {
        // If still open, send a ping and set a short grace; otherwise close
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.ping(); // 'pong' will refresh the watchdog
          // Give it one more window; if we wanted a second-stage timeout,
          // we could set another timer here and terminate if no pong.
          this.watchdogTimer = setTimeout(
            () => {
              try {
                this.ws?.terminate();
              } catch {}
              throw new WebSocketError(`${this.id} channel watchdog timer expired`);
            },
            Math.min(5_000, this.watchdogTimeout),
          );
        }
      } catch {
        try {
          this.ws?.terminate();
        } catch {}
      }
    }, this.watchdogTimeout);
  }

  private clearWatchdog(): void {
    if (!HELPER_WATCHDOG) {
      return; //no-op
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = undefined;
    }
  }
}

export class WebSocketError extends Error {
  constructor(message: string) {
    super(message);
  }
}
