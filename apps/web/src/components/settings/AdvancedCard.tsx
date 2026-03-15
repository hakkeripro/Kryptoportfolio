import { useAuthStore } from '../../store/useAuthStore';

export default function AdvancedCard() {
  const { apiBase, setApiBase } = useAuthStore();

  if (!import.meta.env.DEV) return null;

  return (
    <details
      className="rounded-xl border border-border bg-surface-raised p-4"
      data-testid="card-advanced"
    >
      <summary className="cursor-pointer font-medium">Advanced (dev)</summary>
      <div className="mt-3 space-y-2">
        <div className="text-sm text-content-secondary">
          API base URL (Vite proxy/localhost only).
        </div>
        <input
          data-testid="form-settings-api-base"
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value)}
          className="rounded-lg bg-surface-base border border-border px-3 py-2 text-sm max-w-md w-full"
          placeholder="http://localhost:8788"
        />
      </div>
    </details>
  );
}
