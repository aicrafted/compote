export type Severity = 'error' | 'warning' | 'info';

export interface EnvFieldSpec {
  name: string;
  label: string;
  description?: string;
  defaultValue?: string;
  required: boolean;
  isSecret?: boolean;
  placeholder?: string;
}

export interface VolumeSpec {
  containerPath: string;
  label: string;
  description?: string;
  required: boolean;
  defaultHostPath?: string;
}

export interface ServiceSpec {
  id: string;
  name: string;
  category: string;
  categories?: string[];
  icon?: string;
  description: string;
  image: string;
  defaultImageTag?: string;
  tagsApi?: string;
  version?: string;   // Current version of the config/snippet
  repository?: string; // Upstream repository URL for updates
  tags: string[];

  defaultHostPort?: number;
  preferredPortRange?: [number, number];
  containerPorts: number[];

  requires: string[];        // IDs of hard dependencies
  optionalRequires?: string[];
  conflicts?: string[];      // IDs of conflicting services

  requiredEnv: EnvFieldSpec[];
  optionalEnv?: EnvFieldSpec[];

  volumes?: VolumeSpec[];
  publicExposure?: 'never' | 'optional' | 'recommended';

  persistenceRequired?: boolean;
  healthcheckRecommended?: boolean;

  difficulty?: 'easy' | 'moderate' | 'advanced';
  resourceClass?: 'light' | 'medium' | 'heavy';
  resourceLimits?: {
    memory?: string; // e.g., "512M"
    cpus?: string;   // e.g., "0.5"
  };

  composeTemplate?: string;
  platforms?: string[];
  configFiles?: {
    path: string;      // Destination path relative to the service volume or project root
    content: string;   // Initial template content
    description?: string;
  }[];
}

export interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  categories?: string[];
  description: string;
  source: 'builtin' | 'user';
  tags?: string[];
  resourceClass?: string;
  iconSVG?: boolean;
}

export interface BundleSpec {
  id: string;
  name: string;
  description: string;
  source?: 'builtin' | 'user';
  mainServices: string[];    // IDs of services included by default
  optionalServices?: string[];
  recommendedProxyMode?: 'none' | 'generic' | 'caddy';
  difficulty: 'easy' | 'moderate' | 'advanced';
  resourceClass: 'light' | 'medium' | 'heavy';
  notes?: string[];
}

export interface ServiceConfig {
  serviceId: string;
  enabled: boolean;
  ports: { host: number; container: number; protocol?: 'tcp' | 'udp' }[];
  env: Record<string, string>;
  labels: Record<string, string>;
  volumes: { host: string; container: string; mode?: string; type?: 'bind' | 'volume' }[];
  devices?: ServiceDevice[];
  networks: string[];
  configs?: ServiceResourceRef[];
  secrets?: ServiceResourceRef[];
  publiclyExposed: boolean;
  image?: string;
  imageTag?: string;
  customHostname?: string;
  
  // New runtime controls
  restart?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
  limits?: {
    memory?: string;
    cpus?: string;
  };
  dependsOn?: (string | ServiceDependency)[];
  healthcheck?: ServiceHealthcheck;
  containerName?: string; // compose `container_name:` field

  // Execution
  command?: string;
  entrypoint?: string;
  workingDir?: string;
  user?: string;
  profiles?: string[];

  // Image & Build
  platform?: string;
  pullPolicy?: string;
  build?: {
    context?: string;
    dockerfile?: string;
    target?: string;
    args?: Record<string, string>;
  };

  raw?: any; // Store unsupported properties here to preserve them on export
}

export type ServiceDependencyCondition = 'service_started' | 'service_healthy' | 'service_completed_successfully';

export interface ServiceDependency {
  service: string;
  condition: ServiceDependencyCondition;
}

export interface ServiceDevice {
  host: string;
  container: string;
  permissions?: string;
}

export interface ServiceHealthcheck {
  test?: string;
  interval?: string;
  timeout?: string;
  retries?: number;
  startPeriod?: string;
  disable?: boolean;
}

export interface GlobalSettings {
  os: 'windows' | 'linux' | 'macos' | 'other';
  arch: 'x64' | 'arm64' | 'other';
  
  // Host Environment
  occupiedPorts: number[];   // Ports currently used on the host
  externalNetworks?: string[];
  externalVolumes?: string[];
  serviceRestartMode: 'no' | 'always' | 'unless-stopped' | 'on-failure';
}

export interface ComposeMetadata {
  id: string;
  name: string;
  description?: string;
  lastModified: number;
  validationResults?: RuleResult[];
}

export interface HostMetadata {
  id: string;
  name: string;
  lastModified: number;
  previewServices?: string[]; // IDs of services for icon display in list
  stacks: ComposeMetadata[];
}

export interface TopLevelNetworkDef {
  driver?: 'bridge' | 'host' | 'overlay' | 'macvlan' | 'none';
  external?: boolean;
  name?: string;          // external network name override
  internal?: boolean;     // isolate from external access
  attachable?: boolean;
  labels?: Record<string, string>;
}

export interface TopLevelVolumeDef {
  driver?: string;        // default: 'local'
  external?: boolean;
  name?: string;          // external volume name override
  labels?: Record<string, string>;
}

// Backward compatibility
export interface TopLevelConfigDef {
  file?: string;
  external?: boolean;
  name?: string;          // external config name override
}

export interface TopLevelSecretDef {
  file?: string;
  external?: boolean;
  name?: string;          // external secret name override
}

export interface ServiceResourceRef {
  source: string;
  target?: string;
  mode?: string;
}

export interface ComposeConfig {
  id: string;
  name: string;                // Name of this specific stack (e.g. "media")
  projectName?: string;        // compose `name:` field
  networks?: Record<string, TopLevelNetworkDef>;    // top-level networks
  volumes?: Record<string, TopLevelVolumeDef>;      // top-level volumes
  configs?: Record<string, TopLevelConfigDef>;      // top-level configs
  secrets?: Record<string, TopLevelSecretDef>;      // top-level secrets
  services: Record<string, ServiceConfig>; 
  
  // Parent reference
  hostId: string;
}

// Convenience type — stack data without routing metadata, used in the store
// Convenience type — compose data without routing metadata, used in the store
export type ComposeData = Omit<ComposeConfig, 'id' | 'name' | 'hostId'>;

export interface HostConfig {
  id: string;
  name: string;
  settings: GlobalSettings;
  stacks: HostMetadata['stacks'];
}

export interface RuleResult {
  id: string;
  severity: Severity;
  title: string;
  message: string;
  whyItMatters: string;
  affectedServices: string[];
  suggestedFixes?: string[];
  canAutoFix?: boolean;
  metadata?: {
    missingDependencyId?: string;
    missingEnvKey?: string;
    hostPort?: number;
  };
}

export interface ValidationSummary {
  results: RuleResult[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  isValid: boolean;
}

export interface BundleImportConflict {
  type: 'service' | 'port' | 'volume' | 'network';
  key: string;          // serviceId, port number, volume name, network name
  existingValue: unknown;
  incomingValue: unknown;
  serviceId?: string;   // if applicable (e.g. for port conflict)
}

export interface BundleResolutionMap {
  services: Record<string, 'skip' | 'replace' | 'rename'>;
  ports: Record<number, number>; // current port -> new port
  volumes: Record<string, 'merge' | 'rename'>;
  networks: Record<string, 'merge' | 'rename'>;
}
