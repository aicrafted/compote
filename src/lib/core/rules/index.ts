import { ComposeData, RuleResult, ValidationSummary, GlobalSettings } from '@/types';
import { getServiceSpecOrFallback } from '@/lib/catalog/spec-utils';

export type RuleFunction = (config: ComposeData, settings: GlobalSettings) => RuleResult[];

const rules: RuleFunction[] = [
  checkPortConflicts,
  checkHostPortConflicts, // Conflict with existing host services
  checkMissingDependencies,
  checkRequiredEnv,
];

export function validateStack(config: ComposeData, settings: GlobalSettings): ValidationSummary {
  const results = rules.flatMap(rule => rule(config, settings));
  
  const errorCount = results.filter(r => r.severity === 'error').length;
  const warningCount = results.filter(r => r.severity === 'warning').length;
  const infoCount = results.filter(r => r.severity === 'info').length;

  return {
    results,
    errorCount,
    warningCount,
    infoCount,
    isValid: errorCount === 0,
  };
}

/**
 * Rule: Detect duplicate host ports across enabled services.
 */
function checkPortConflicts(config: ComposeData, _settings: GlobalSettings): RuleResult[] {
  const results: RuleResult[] = [];
  const portMap: Record<number, string[]> = {};

  Object.entries(config.services).forEach(([id, svc]) => {
    if (svc.enabled) {
      svc.ports.forEach(p => {
        const port = p.host;
        if (port) {
          if (!portMap[port]) portMap[port] = [];
          portMap[port].push(id);
        }
      });
    }
  });

  Object.entries(portMap).forEach(([port, serviceIds]) => {
    if (serviceIds.length > 1) {
      results.push({
        id: `port-conflict-${port}`,
        severity: 'error',
        title: 'Port Conflict',
        message: `Port ${port} is assigned to multiple services: ${serviceIds.join(', ')}.`,
        whyItMatters: 'Only one process can listen on a host port at a time. This will prevent the stack from starting.',
        affectedServices: serviceIds,
        canAutoFix: true,
        suggestedFixes: ['Assign automatic unique ports to conflicting services.'],
        metadata: { hostPort: Number(port) },
      });
    }
  });

  return results;
}

/**
 * Rule: Detect conflicts between enabled services and legacy host ports.
 */
function checkHostPortConflicts(config: ComposeData, settings: GlobalSettings): RuleResult[] {
  const results: RuleResult[] = [];
  const occupied = new Set(settings.occupiedPorts);

  Object.entries(config.services).forEach(([id, svc]) => {
    if (svc.enabled) {
      svc.ports.forEach(p => {
        const port = p.host;
        if (port && occupied.has(port)) {
          results.push({
            id: `host-port-conflict-${id}-${port}`,
            severity: 'error',
            title: 'Host Port Collision',
            message: `Port ${port} is already in use by another service on your host machine.`,
            whyItMatters: 'Docker cannot bind to a port that is already in use. The container will fail to start.',
            affectedServices: [id],
            canAutoFix: true,
            suggestedFixes: [`Change host port ${port} for ${id} to a different value.`],
            metadata: { hostPort: port },
          });
        }
      });
    }
  });

  return results;
}

/**
 * Rule: Detect missing hard dependencies.
 */
function checkMissingDependencies(config: ComposeData, _settings: GlobalSettings): RuleResult[] {
  const results: RuleResult[] = [];

  Object.entries(config.services).forEach(([id, svc]) => {
    if (!svc.enabled) return;

    const spec = getServiceSpecOrFallback(svc.serviceId, svc);

    (spec.requires || []).forEach(depId => {
      const depConfig = config.services[depId];
      if (!depConfig || !depConfig.enabled) {
        results.push({
          id: `missing-dep-${svc.serviceId}-${depId}`,
          severity: 'error',
          title: 'Missing Dependency',
          message: `${spec.name} requires ${depId} to function, but it is not enabled.`,
          whyItMatters: 'The service will fail to connect and crash on startup.',
          affectedServices: [id],
          canAutoFix: true,
          suggestedFixes: [`Enable ${depId} automatically.`],
          metadata: { missingDependencyId: depId },
        });
      }
    });
  });

  return results;
}

/**
 * Rule: Detect missing required environment variables.
 */
function checkRequiredEnv(config: ComposeData, _settings: GlobalSettings): RuleResult[] {
  const results: RuleResult[] = [];

  Object.entries(config.services).forEach(([id, svc]) => {
    if (!svc.enabled) return;

    const spec = getServiceSpecOrFallback(svc.serviceId, svc);

    (spec.requiredEnv || []).forEach(envSpec => {
      const value = svc.env[envSpec.name];
      if (!value || value.trim() === '') {
        results.push({
          id: `missing-env-${svc.serviceId}-${envSpec.name}`,
          severity: 'error',
          title: 'Missing Required Configuration',
          message: `${spec.name} requires '${envSpec.label}' (${envSpec.name}) to be set.`,
          whyItMatters: 'Most services refuse to start without critical environment variables like database passwords.',
          affectedServices: [id],
          canAutoFix: true,
          suggestedFixes: ['Set a value for this environment variable.'],
          metadata: { missingEnvKey: envSpec.name },
        });
      }
    });
  });

  return results;
}
