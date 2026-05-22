export default function ErrorMessage({ message, onRetry }) {
  if (!message) return null

  return (
    <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-red-200">
      <p className="text-sm font-medium">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-sm text-orange-400 underline hover:text-orange-300"
        >
          Try again
        </button>
      )}
    </div>
  )
}
