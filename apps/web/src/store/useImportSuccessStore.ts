import { create } from 'zustand';

type ImportSuccessBanner = {
  provider: string;
  count: number;
};

type ImportSuccessState = {
  pendingBanner: ImportSuccessBanner | null;
  setBanner: (provider: string, count: number) => void;
  clearBanner: () => void;
};

export const useImportSuccessStore = create<ImportSuccessState>()((set) => ({
  pendingBanner: null,
  setBanner: (provider, count) => set({ pendingBanner: { provider, count } }),
  clearBanner: () => set({ pendingBanner: null }),
}));
