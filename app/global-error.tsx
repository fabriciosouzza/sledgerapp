"use client";

/** Last resort: the root layout itself failed, so this renders its own html. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ opacity: 0.7 }}>Nothing you recorded was lost.</p>
        <button type="button" onClick={reset} style={{ marginTop: "1rem", padding: "0.75rem 1.25rem", borderRadius: "0.5rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
