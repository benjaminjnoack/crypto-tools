import { getClient } from "../db/client.js";
import { z } from "zod";
import { logger } from "#shared/log/index";

const TestQueryRowSchema = z.object({
  now: z.union([z.date(), z.string()]),
});

const TestQueryResultSchema = z.object({
  rows: z.array(TestQueryRowSchema).min(1),
});

export async function handleTestAction() {
  const client = await getClient();
  const result = await client.query("SELECT NOW() AS now");
  const parsedResult = TestQueryResultSchema.parse(result);
  const [firstRow] = parsedResult.rows;

  if (!firstRow) {
    throw new Error("Expected at least one row from test query");
  }

  const output = firstRow.now instanceof Date ? firstRow.now.toISOString() : firstRow.now;
  logger.info(output);
}
