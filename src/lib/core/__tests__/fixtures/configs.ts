import { ComposeData, GlobalSettings, ServiceConfig } from '@/types';

export const defaultSettings: GlobalSettings = {
  os: 'linux',
  arch: 'x64',
  occupiedPorts: [],
  serviceRestartMode: 'unless-stopped',
};

export const minimalService = (overrides: Partial<ServiceConfig> = {}): ServiceConfig => ({
  serviceId: 'nginx',
  enabled: true,
  ports: [],
  env: {},
  labels: {},
  volumes: [],
  networks: [],
  publiclyExposed: false,
  ...overrides,
});

export const minimalConfig = (overrides: Partial<ComposeData> = {}): ComposeData => ({
  services: {},
  networks: {},
  volumes: {},
  ...overrides,
});
