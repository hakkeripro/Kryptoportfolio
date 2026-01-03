import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';

export default function DerivedBootstrap() {
  const { vaultReady, vaultSetup, passphrase } = useAppStore((s) => ({
    vaultReady: s.vaultReady,
    vaultSetup: s.vaultSetup,
    passphrase: s.passphrase
  }));
  const [ran, setRan] = useState(false);

  useEffect(() => {
    if (ran) return;
    if (!vaultReady || !vaultSetup || !passphrase) return;
    setRan(true);
    void (async () => {
      await ensureDefaultSettings();
      await rebuildDerivedCaches({ daysBack: 365 });
    })();
  }, [vaultReady, vaultSetup, passphrase, ran]);

  return null;
}
