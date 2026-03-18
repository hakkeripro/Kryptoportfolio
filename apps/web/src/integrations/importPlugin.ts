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

export interface CsvUploadFormProps {
  ctx: ImportContext;
}

export interface ApiCapability {
  ConnectForm: React.FC<ConnectFormProps>;
  FetchPanel: React.FC<FetchPanelProps>;
  isConnected: (passphrase: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
}

export interface CsvCapability {
  UploadForm: React.FC<CsvUploadFormProps>;
}

export interface ImportPlugin {
  descriptor: ProviderDescriptor;
  /** API-autosync capability (API key + server-side proxy) */
  api?: ApiCapability;
  /** CSV upload capability (client-side parsing, ZK-compatible) */
  csv?: CsvCapability;
  // At least one of api or csv must be defined
}
