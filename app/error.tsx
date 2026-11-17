"use client";

/** Last resort: a rendering failure still has to say what to do next. */
export default function ErrorBoundary({ reset }: { readonly reset: () => void }) {
  return (
    <div className="stack">
      <h1>This page did not render</h1>
      <p className="notice notice-bad" role="alert">
        Something failed while assessing the fleet. The verdicts you were looking at are not
        incomplete, they were never produced.
      </p>
      <p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </p>
      <p>
        <a href="/">Back to the directive list</a>
      </p>
    </div>
  );
}
