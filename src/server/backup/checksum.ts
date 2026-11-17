import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return hash.digest("hex");
}

export async function writeSha256Sidecar(
  filePath: string,
  hex: string,
): Promise<string> {
  const side = `${filePath}.sha256`;
  await writeFile(side, `${hex}  ${filePath.split("/").pop()}\n`, "utf8");
  return side;
}
