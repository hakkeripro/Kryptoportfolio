export type AuthMethod = 'api-key' | 'csv' | 'address' | 'oauth';
export type ProviderStatus = 'connected' | 'available' | 'coming-soon' | 'error';

export interface ProviderDescriptor {
  id: string;
  name: string;
  authMethods: AuthMethod[];
  category: 'exchange' | 'wallet' | 'csv';
  docUrl?: string;
}
