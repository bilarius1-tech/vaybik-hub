"use client";

/** Минимальный global-error без провайдеров темы (TZ / Next 16 prerender) */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#0a0f1e",
          color: "#e8ecf8",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Что-то пошло не так</h1>
        <p style={{ color: "#9aa5c3", fontSize: 14 }}>
          Обновите страницу или вернитесь позже.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 12,
            background: "#ff8a1f",
            color: "#1a0e02",
            border: 0,
            borderRadius: 10,
            padding: "8px 14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Повторить
        </button>
      </body>
    </html>
  );
}
