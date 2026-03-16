import type { ProviderDescriptor } from '@kp/core';
import type React from 'react';

export interface ImportContext {
  passphrase: string;
  token: string;
  apiBase: string;
}

export interface ConnectFormProps {
  ctx: ImportContext;
  onConnected: () => void;
}

export interface FetchPanelProps {
  ctx: ImportContext;
}

export interface ImportPlugin {
  descriptor: ProviderDescriptor;
  /** Inline connect form rendered inside the provider card */
  ConnectForm: React.FC<ConnectFormProps>;
  /** Full-width fetch/preview/done panel rendered below the provider grid */
  FetchPanel: React.FC<FetchPanelProps>;
  /** Returns true if credentials are saved in vault */
  isConnected: (passphrase: string) => Promise<boolean>;
  /** Clears vault credentials */
  disconnect: () => Promise<void>;
}
