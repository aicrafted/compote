import { ComposeData } from '@/types';
import { getServiceSpecOrFallback } from '@/lib/catalog/spec-utils';

export function renderReadme(
  config: ComposeData,
  stackName?: string,
  stackDescription?: string,
): string {
  const projectName = stackName || 'My Stack';
  const services = Object.entries(config.services)
    .filter(([, svc]) => svc.enabled)
    .sort(([a], [b]) => a.localeCompare(b));

  let readme = `# ${projectName}\n\n`;

  if (stackDescription) {
    readme += `${stackDescription}\n\n`;
  }

  readme += `## Quick Start\n\n`;
  readme += `1. Ensure Docker and Docker Compose are installed.\n`;
  readme += `2. Extract the bundle and navigate to the project directory.\n`;
  readme += `3. Start the stack:\n\n`;
  readme += `\`\`\`bash\ndocker compose up -d\n\`\`\`\n\n`;

  if (services.length === 0) {
    readme += `*No services configured yet.*\n\n`;
  } else {
    readme += `## Services\n\n`;
    readme += `| Instance | Service | Image | Port |\n`;
    readme += `| :--- | :--- | :--- | :--- |\n`;
    services.forEach(([id, svc]) => {
      const spec = getServiceSpecOrFallback(svc.serviceId, svc);
      const imageSplit = splitImageRef(svc.image || spec.image);
      const imageRef = `${imageSplit.base}:${svc.imageTag || imageSplit.tag || 'latest'}`;
      const port = svc.ports.length > 0 ? `\`${svc.ports[0].host}\`` : '—';
      readme += `| \`${id}\` | ${spec.name} | \`${imageRef}\` | ${port} |\n`;
    });
    readme += `\n`;
  }

  // Prerequisites: external networks/volumes
  const externalNetworks = Object.entries(config.networks || {}).filter(([, def]) => def?.external);
  const externalVolumes = Object.entries(config.volumes || {}).filter(([, def]) => def?.external);

  if (externalNetworks.length > 0 || externalVolumes.length > 0) {
    readme += `## Prerequisites\n\n`;

    if (externalNetworks.length > 0) {
      readme += `**External networks** — must exist before starting:\n\n`;
      externalNetworks.forEach(([name, def]) => {
        const display = def?.name || name;
        readme += `\`\`\`bash\ndocker network create ${display}\n\`\`\`\n`;
      });
      readme += `\n`;
    }

    if (externalVolumes.length > 0) {
      readme += `**External volumes** — must exist before starting:\n\n`;
      externalVolumes.forEach(([name, def]) => {
        readme += `- \`${def?.name || name}\`\n`;
      });
      readme += `\n`;
    }
  }

  readme += `---\n*Created with [compote](https://github.com/aicrafted/compote)*\n`;

  return readme;
}

function splitImageRef(image: string): { base: string; tag?: string } {
  const slashIndex = image.lastIndexOf('/');
  const colonIndex = image.lastIndexOf(':');
  if (colonIndex > slashIndex) {
    return { base: image.slice(0, colonIndex), tag: image.slice(colonIndex + 1) || undefined };
  }
  return { base: image };
}
