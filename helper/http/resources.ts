import { getBodyFromRequest, getQueryStringParameter, writeResponseJSON } from '@http/httpUtil';
import {
  positionState,
  positionCancel,
  positionModify,
  positionOpen,
  positionSell,
  positionFills,
  positionFireSale,
  execPosition,
  positionPrep,
  positionBreakEven,
  positionTakeProfit,
  positionSchedule,
  positionSave,
  positionClear,
  positionAsk,
  positionTrail,
} from '../positions.mjs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
// Convert exec to return a promise
const execPromise = promisify(exec);
import { positionStatuses } from '../positions.mjs';
import { formatDistanceToNow } from 'date-fns';
import { getVersion } from '../project_version.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isCorrectMethod } from '@http/validators';
import {
  type BreakRequest,
  BreakRequestSchema,
  type ExecRequest,
  ExecRequestSchema,
  type ModifyRequest,
  ModifyRequestSchema,
  type OpenRequest,
  OpenRequestSchema,
  type PrepRequest,
  PrepRequestSchema,
  type ScheduleRequest,
  ScheduleRequestSchema,
  type TakeProfitRequest,
  TakeProfitRequestSchema,
  type TrailRequest,
  TrailRequestSchema,
} from '@http/contracts';

export async function handleAskRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  isCorrectMethod(req, 'DELETE', 'ask'); //TODO change method

  const position = getQueryStringParameter(req, 'position');
  if (!position) {
    throw new Error('missing position');
  }
  const response = await positionAsk(position);
  writeResponseJSON(res, response);
}

export async function handleBreakRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  isCorrectMethod(req, 'POST', 'break');

  const body = await getBodyFromRequest(req);
  const breakRequest: BreakRequest = BreakRequestSchema.parse(body);
  const response = await positionBreakEven(breakRequest.position);
  writeResponseJSON(res, response);
}

export async function handleCancelRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  isCorrectMethod(req, 'DELETE', 'cancel');
  const position = getQueryStringParameter(req, 'position');
  if (!position) {
    throw new Error('missing position');
  }
  const response = await positionCancel(position);
  writeResponseJSON(res, response);
}

export async function handleClearRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  isCorrectMethod(req, 'DELETE', 'clear');

  const position = getQueryStringParameter(req, 'position');
  const response = await positionClear(position);
  writeResponseJSON(res, response);
}

export async function handleExecRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  isCorrectMethod(req, 'POST', 'exec');

  const body = await getBodyFromRequest(req);
  const execRequest: ExecRequest = ExecRequestSchema.parse(body);
  const response = await execPosition(execRequest.position);
  writeResponseJSON(res, response);
}

export async function handleFillsRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  isCorrectMethod(req, 'GET', 'fills');

  const position = getQueryStringParameter(req, 'position');
  if (!position) {
    throw new Error('missing position');
  }

  const fills = await positionFills(position);
  writeResponseJSON(res, fills);
}

export async function handleFireRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  isCorrectMethod(req, 'GET', 'fire');
  await positionFireSale();
  writeResponseJSON(res, {
    message: 'It has been dumped.',
  });
}

export async function handleModifyRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  isCorrectMethod(req, 'PATCH', 'modify');

  const body = await getBodyFromRequest(req);
  const modifyRequest: ModifyRequest = ModifyRequestSchema.parse(body);

  const response = await positionModify(
    modifyRequest.position,
    modifyRequest.buy_price || null,
    modifyRequest.stop_price || null,
    modifyRequest.target_price || null,
    modifyRequest.order_id || null,
  );
  writeResponseJSON(res, response);
}

export async function handleOpenRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  isCorrectMethod(req, 'POST', 'open');

  const body = await getBodyFromRequest(req);
  const openRequest: OpenRequest = OpenRequestSchema.parse(body);

  const response = await positionOpen(
    openRequest.product,
    openRequest.buy_price,
    openRequest.value,
    openRequest.take_profit_price,
    openRequest.stop_price,
  );
  writeResponseJSON(res, response);
}

export async function handlePrepRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  isCorrectMethod(req, 'POST', 'prep');

  const body = await getBodyFromRequest(req);
  const prepRequest: PrepRequest = PrepRequestSchema.parse(body);
  const response = await positionPrep(
    prepRequest.product,
    prepRequest.buy_price,
    prepRequest.value,
    prepRequest.take_profit_price,
    prepRequest.stop_price,
  );

  writeResponseJSON(res, response);
}

export async function handleSaveRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  isCorrectMethod(req, 'GET', 'save');
  const saved = await positionSave();
  writeResponseJSON(res, saved);
}

export async function handleScheduleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  isCorrectMethod(req, 'POST', 'schedule');

  const body = await getBodyFromRequest(req);
  const scheduleRequest: ScheduleRequest = ScheduleRequestSchema.parse(body);
  const response = await positionSchedule(
    scheduleRequest.position,
    scheduleRequest.schedule,
    scheduleRequest.zero_price,
    scheduleRequest.one_price,
  );
  writeResponseJSON(res, response);
}

export async function handleSellRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  isCorrectMethod(req, 'DELETE', 'sell');
  const position = getQueryStringParameter(req, 'position');
  if (!position) {
    throw new Error(`missing position query string parameter`);
  }

  const response = await positionSell(position);
  writeResponseJSON(res, response);
}

export async function handleStateRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  isCorrectMethod(req, 'GET', 'state');
  const position = getQueryStringParameter(req, 'position');
  if (!position) {
    throw new Error(`missing position query string parameter`);
  }

  const positionStates = await positionState(position);
  writeResponseJSON(res, positionStates);
}

export async function handleStatusRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  isCorrectMethod(req, 'GET', 'status');
  const version = await getVersion();
  const { stdout } = await execPromise(
    'systemctl show --property=ActiveState --property=StateChangeTimestamp helper',
    { encoding: 'utf8' }, // ensures stdout is string
  );

  // Parse "KEY=VALUE" lines into an object
  const kv = Object.fromEntries(
    stdout
      .trim()
      .split('\n')
      .map((line) => {
        const idx = line.indexOf('=');
        return idx === -1 ? [line, ''] : [line.slice(0, idx), line.slice(idx + 1)];
      }),
  ) as Record<string, string>;

  const state = kv.ActiveState ?? 'unknown';
  const tsRaw = kv.StateChangeTimestamp ?? '';
  const parsedDate = tsRaw ? new Date(tsRaw) : new Date(NaN); // NaN date if missing

  writeResponseJSON(res, {
    version,
    state,
    timestamp: tsRaw || null,
    uptime: isNaN(parsedDate.getTime())
      ? null
      : formatDistanceToNow(parsedDate, { addSuffix: true }),
    positions: positionStatuses(),
  });
}

export async function handleTakeProfitRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  isCorrectMethod(req, 'POST', 'take');

  const body = await getBodyFromRequest(req);
  const takeProfitRequest: TakeProfitRequest = TakeProfitRequestSchema.parse(body);

  const response = await positionTakeProfit(
    takeProfitRequest.position,
    takeProfitRequest.take_profit_price,
  );
  writeResponseJSON(res, response);
}

export async function handleTrailRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  isCorrectMethod(req, 'POST', 'trail');

  const body = await getBodyFromRequest(req);
  const trailRequest: TrailRequest = TrailRequestSchema.parse(body);

  const response = await positionTrail(
    trailRequest.position,
    trailRequest.stop_loss_price,
    trailRequest.target_price,
  );
  writeResponseJSON(res, response);
}
