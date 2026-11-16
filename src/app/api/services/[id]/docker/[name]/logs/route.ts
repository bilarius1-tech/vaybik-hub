import { NextRequest } from "next/server";
import { requireCan } from "@/server/auth/require";
import {
  demuxDockerLogs,
  getLogsTail,
  streamLogs,
} from "@/server/docker/service";
import { handleRouteError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string; name: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("services.manage");
    const { id, name } = await ctx.params;
    const containerName = decodeURIComponent(name);
    const tail = Number(req.nextUrl.searchParams.get("tail") || "200");
    const follow = req.nextUrl.searchParams.get("follow") === "1";
    const download = req.nextUrl.searchParams.get("download") === "1";
    const filter = req.nextUrl.searchParams.get("q") || "";

    if (follow) {
      const stream = await streamLogs(id, containerName, {
        tail: Math.min(tail, 500),
        timestamps: true,
      });

      const encoder = new TextEncoder();
      let buffer = Buffer.alloc(0);
      const readable = new ReadableStream({
        start(controller) {
          stream.on("data", (chunk: Buffer) => {
            buffer = Buffer.concat([buffer, chunk]);
            // try demux complete frames
            let text = "";
            try {
              text = demuxDockerLogs(buffer);
              // keep incomplete tail heuristically
              if (buffer.length > 8 && text.length === 0) return;
            } catch {
              text = chunk.toString("utf8");
            }
            buffer = Buffer.alloc(0);
            const lines = text.split(/\r?\n/);
            for (const line of lines) {
              if (!line) continue;
              if (filter && !line.toLowerCase().includes(filter.toLowerCase())) {
                continue;
              }
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(line)}\n\n`),
              );
            }
          });
          stream.on("end", () => controller.close());
          stream.on("error", (err) => controller.error(err));
        },
        cancel() {
          if ("destroy" in stream && typeof stream.destroy === "function") {
            stream.destroy();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    let logs = await getLogsTail(id, containerName, {
      tail: Math.min(Math.max(tail, 1), 5000),
      timestamps: true,
    });
    if (filter) {
      logs = logs
        .split(/\r?\n/)
        .filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
        .join("\n");
    }

    if (download) {
      return new Response(logs, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${containerName}-logs.txt"`,
        },
      });
    }

    return jsonOk({ logs });
  } catch (err) {
    return handleRouteError(err);
  }
}
