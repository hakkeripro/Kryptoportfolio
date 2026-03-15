import { useState, useCallback } from 'react';
import { generatePassphrase } from '@kp/core';

export default function PassphraseGenerator({
  onAccept,
}: {
  onAccept: (passphrase: string) => void;
}) {
  const [phrase, setPhrase] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = useCallback(() => {
    const pp = generatePassphrase(6);
    setPhrase(pp);
    setCopied(false);
  }, []);

  const copy = useCallback(async () => {
    if (!phrase) return;
    await navigator.clipboard.writeText(phrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [phrase]);

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-content-secondary">Generate a passphrase</span>
        <button
          type="button"
          onClick={generate}
          className="text-xs rounded bg-brand hover:bg-brand-dark px-2 py-1 font-medium"
        >
          Generate
        </button>
      </div>
      {phrase && (
        <>
          <div
            data-testid="generated-passphrase"
            className="font-mono text-sm bg-surface-base rounded px-3 py-2 select-all break-all"
          >
            {phrase}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="text-xs rounded bg-surface-raised hover:bg-border px-2 py-1"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() => onAccept(phrase)}
              className="text-xs rounded bg-brand hover:bg-brand-dark px-2 py-1"
            >
              Use this passphrase
            </button>
          </div>
        </>
      )}
    </div>
  );
}
