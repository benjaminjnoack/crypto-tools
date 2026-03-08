import { z } from "zod";
import packageJson from "../package.json" with { type: "json" };

const PackageJsonSchema = z.object({
  version: z.string(),
}).loose();
const parsedPackageJson = PackageJsonSchema.parse(packageJson);
const PROJECT_VERSION = parsedPackageJson.version;

export function getVersion(): string {
  return PROJECT_VERSION;
}
