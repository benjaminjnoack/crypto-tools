const ORDER_ID_BASE = 426614174000;

/**
 * Deterministic Coinbase-style UUID fixtures used across tests.
 * Example: 123e4567-e89b-42d3-a456-426614174000
 */
export function makeOrderId(offset = 0): string {
  const suffix = String(ORDER_ID_BASE + offset).padStart(12, "0");
  return `123e4567-e89b-42d3-a456-${suffix}`;
}

/**
 * Deterministic v4-shaped UUID fixture for client_order_id fields.
 * Example: 00000000-0000-4000-8000-000000000001
 */
export function makeClientOrderId(offset = 1): string {
  const suffix = String(offset).padStart(12, "0");
  return `00000000-0000-4000-8000-${suffix}`;
}

export const DEFAULT_ORDER_ID = makeOrderId(0);

export function makeEntityUuid(prefix = 1): string {
  return `${prefix}23e4567-e89b-12d3-a456-426614174000`;
}
