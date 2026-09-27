import { Link } from 'react-router';

export function Loading() {
  return (
    <p role="status" className="appear-late text-graphite">
      Loading…
    </p>
  );
}

export function ErrorNotice({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="max-w-xl border-l-2 border-brick py-1 pl-4">
      <p>{error.message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="button button-small mt-3">
          Try again
        </button>
      )}
    </div>
  );
}

export function NotFound({ message = "This page doesn't exist." }: { message?: string }) {
  return (
    <div className="max-w-xl">
      <title>Not found | Cognibloom</title>
      <h1 className="text-2xl font-semibold">{message}</h1>
      <p className="mt-2 text-graphite">Check the link, or pick up from your topics.</p>
      <Link to="/topics" className="button mt-5">
        Go to topics
      </Link>
    </div>
  );
}
