import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function WelcomePage() {
  const nav = useNavigate();
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div
      data-testid="page-welcome"
      className="min-h-screen flex flex-col items-center justify-center px-4"
    >
      <div className="text-center space-y-2 mb-10">
        <h1 className="text-3xl font-bold">Kryptoportfolio</h1>
        <p className="text-slate-400">Track your crypto portfolio with zero-knowledge encryption</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <button
          data-testid="btn-signin"
          onClick={() => nav('/auth/signin')}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-3 text-sm font-medium"
        >
          Sign in
        </button>
        <button
          data-testid="btn-signup"
          onClick={() => nav('/auth/signup')}
          className="w-full rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-900 px-4 py-3 text-sm font-medium"
        >
          Create account
        </button>
        <button
          data-testid="btn-offline"
          onClick={() => nav('/vault/setup?offline=1')}
          className="w-full text-sm text-slate-500 hover:text-slate-400 py-2"
        >
          Use without account
        </button>
      </div>

      <div className="mt-8 w-full max-w-sm">
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-sm text-slate-500 hover:text-slate-400 underline"
        >
          What is a Vault Passphrase?
        </button>
        {showInfo && (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300 space-y-2">
            <p>
              Your <strong>Vault Passphrase</strong> encrypts all your data locally before it ever
              leaves your device.
            </p>
            <p>
              The server never sees your passphrase or unencrypted data. The same passphrase works on
              all your devices.
            </p>
            <p className="text-slate-400">
              If you lose your passphrase, your data cannot be recovered.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
