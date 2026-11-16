import { describe, expect, it } from "vitest";
import { demuxDockerLogs } from "./service";

describe("demuxDockerLogs", () => {
  it("разбирает multiplexed docker stream", () => {
    const payload = Buffer.from("hello\n", "utf8");
    const header = Buffer.alloc(8);
    header[0] = 1; // stdout
    header.writeUInt32BE(payload.length, 4);
    const out = demuxDockerLogs(Buffer.concat([header, payload]));
    expect(out).toBe("hello\n");
  });

  it("оставляет plain text как есть", () => {
    expect(demuxDockerLogs("plain line\n")).toBe("plain line\n");
  });
});
