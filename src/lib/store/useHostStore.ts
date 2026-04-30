import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './storage';
import { HostMetadata, GlobalSettings, ComposeMetadata, RuleResult } from '@/types';
import { composeRepository } from '@/lib/storage/ComposeRepository';

export const DEFAULT_SETTINGS: GlobalSettings = {
  os: 'linux',
  arch: 'x64',
  occupiedPorts: [],
  externalNetworks: [],
  externalVolumes: [],
  serviceRestartMode: 'unless-stopped',
};

interface HostState {
  hosts: HostMetadata[];
  settings: GlobalSettings;
  _hasHydrated: boolean;

  createHost: (name: string) => Promise<string>;
  deleteHost: (id: string) => Promise<void>;
  updateHostName: (id: string, name: string) => void;
  updateSettings: (settings: Partial<GlobalSettings>) => void;
  syncPreview: (id: string, services: string[]) => void;

  createCompose: (hostId: string, name: string, id?: string) => Promise<string>;
  deleteCompose: (hostId: string, composeId: string) => Promise<void>;
  updateComposeName: (hostId: string, composeId: string, name: string) => void;
  updateComposeValidation: (hostId: string, composeId: string, results: RuleResult[]) => void;

  detectAndSetEnvironment: () => Promise<void>;
  setHasHydrated: (state: boolean) => void;
}

export const useHostStore = create<HostState>()(
  persist(
    (set, get) => ({
      hosts: [],
      settings: DEFAULT_SETTINGS,
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      createHost: async (name) => {
        const id = crypto.randomUUID();
        const defaultComposeId = crypto.randomUUID();
        const newHost: HostMetadata = {
          id,
          name,
          lastModified: Date.now(),
          stacks: [{ id: defaultComposeId, name: 'Default Compose', lastModified: Date.now() }],
        };
        set((state) => ({
          hosts: [newHost, ...state.hosts],
          settings: DEFAULT_SETTINGS,
        }));
        return id;
      },

      deleteHost: async (id) => {
        const host = get().hosts.find((p) => p.id === id);
        if (host) {
          for (const s of host.stacks) {
            await composeRepository.delete(id, s.id);
          }
        }
        set((state) => ({
          hosts: state.hosts.filter((p) => p.id !== id),
        }));
      },

      updateHostName: (id, name) => {
        set((state) => ({
          hosts: state.hosts.map((p) => (p.id === id ? { ...p, name, lastModified: Date.now() } : p)),
        }));
      },

      updateSettings: (settings) => {
        set((state) => ({
          settings: { ...state.settings, ...settings },
        }));
      },

      syncPreview: (id, services) => {
        set((state) => ({
          hosts: state.hosts.map((p) => (p.id === id ? { ...p, previewServices: services.slice(0, 4) } : p)),
        }));
      },

      createCompose: async (hostId, name, id) => {
        const composeId = id ?? crypto.randomUUID();
        const composeMeta: ComposeMetadata = { id: composeId, name, lastModified: Date.now() };
        set((state) => ({
          hosts: state.hosts.map((p) =>
            p.id === hostId
              ? {
                  ...p,
                  stacks: [...p.stacks, composeMeta],
                  lastModified: Date.now(),
                }
              : p
          ),
        }));
        return composeId;
      },

      deleteCompose: async (hostId, composeId) => {
        await composeRepository.delete(hostId, composeId);
        set((state) => ({
          hosts: state.hosts.map((p) =>
            p.id === hostId
              ? {
                  ...p,
                  stacks: p.stacks.filter((s) => s.id !== composeId),
                  lastModified: Date.now(),
                }
              : p
          ),
        }));
      },

      updateComposeName: (hostId, composeId, name) => {
        set((state) => ({
          hosts: state.hosts.map((p) =>
            p.id === hostId
              ? {
                  ...p,
                  stacks: p.stacks.map((s) => (s.id === composeId ? { ...s, name, lastModified: Date.now() } : s)),
                  lastModified: Date.now(),
                }
              : p
          ),
        }));
      },

      updateComposeValidation: (hostId, composeId, results) => {
        set((state) => ({
          hosts: state.hosts.map((p) =>
            p.id === hostId
              ? {
                  ...p,
                  stacks: p.stacks.map((s) =>
                    s.id === composeId ? { ...s, validationResults: results } : s
                  ),
                }
              : p
          ),
        }));
      },

      detectAndSetEnvironment: async () => {
        const ua = navigator.userAgent.toLowerCase();
        const platform = (navigator as any).platform?.toLowerCase() || '';
        let os: GlobalSettings['os'] = 'linux';
        let arch: GlobalSettings['arch'] = 'x64';
        if (ua.includes('win') || platform.includes('win')) os = 'windows';
        else if (ua.includes('mac') || platform.includes('mac')) os = 'macos';
        if (ua.includes('arm') || ua.includes('aarch64')) arch = 'arm64';
        set((state) => ({
          settings: { ...state.settings, os, arch },
        }));
      },
    }),
    {
      name: 'compot-host-registry',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        hosts: state.hosts,
        settings: state.settings,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
