import { z } from "zod";

export const CredentialsSchema = z.object({
  name: z.string(),
  privateKey: z.string(),
});

export type Credentials = z.infer<typeof CredentialsSchema>;
