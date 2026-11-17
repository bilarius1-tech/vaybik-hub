import { describe, expect, it } from "vitest";
import {
  assertAllowedSrc,
  chatWidgetApplies,
  chatWidgetSnippetPreview,
  parseChatWidget,
  renderChatWidgetScript,
} from "./chat-widget";

describe("chat-widget", () => {
  it("отклоняет чужой src", () => {
    const cfg = assertAllowedSrc(
      parseChatWidget({
        enabled: true,
        src: "https://evil.example/widget.js",
        publicId: "abc",
        paths: [],
      }),
    );
    expect(cfg.src).toBe("https://chat.vaybik.ru/widget.js");
  });

  it("разрешает chat-test.vaybik.ru", () => {
    const cfg = assertAllowedSrc(
      parseChatWidget({
        enabled: true,
        src: "https://chat-test.vaybik.ru/widget.js",
        publicId: "x",
        paths: [],
      }),
    );
    expect(cfg.src).toBe("https://chat-test.vaybik.ru/widget.js");
  });

  it("paths пусто → весь сайт; иначе только совпадения", () => {
    const all = parseChatWidget({
      enabled: true,
      publicId: "xA6FHnneH5CW",
      paths: [],
    });
    expect(chatWidgetApplies(all, "/")).toBe(true);
    expect(chatWidgetApplies(all, "/kalkulyator/")).toBe(true);

    const home = parseChatWidget({
      enabled: true,
      publicId: "xA6FHnneH5CW",
      paths: ["/"],
    });
    expect(chatWidgetApplies(home, "/")).toBe(true);
    expect(chatWidgetApplies(home, "/kalkulyator/")).toBe(false);
  });

  it("рендерит script с data-id", () => {
    const html = renderChatWidgetScript(
      parseChatWidget({
        enabled: true,
        publicId: "xA6FHnneH5CW",
        paths: ["/"],
      }),
    );
    expect(html).toBe(
      '<script src="https://chat.vaybik.ru/widget.js" data-id="xA6FHnneH5CW" async></script>',
    );
    expect(chatWidgetSnippetPreview(parseChatWidget({}))).toContain(
      "YOUR_PUBLIC_ID",
    );
  });

  it("без publicId / disabled — пустая строка", () => {
    expect(
      renderChatWidgetScript(parseChatWidget({ enabled: true, publicId: "" })),
    ).toBe("");
    expect(
      renderChatWidgetScript(
        parseChatWidget({ enabled: false, publicId: "x" }),
      ),
    ).toBe("");
  });
});
