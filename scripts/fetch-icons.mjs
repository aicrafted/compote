#!/usr/bin/env node
/**
 * Fetches colored SVG icons for catalog services.
 *
 * Sources:
 *   si      — https://cdn.simpleicons.org/{slug}
 *             Returns SVG filled with the official brand color. No install needed.
 *   selfhst — https://cdn.jsdelivr.net/gh/selfhst/icons@main/svg/{slug}.svg
 *             Homelab-specific icon set (Sonarr, Radarr, Vaultwarden, etc.)
 *   dash    — https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/{slug}.svg
 *             dashboardicons.com — broad homelab/self-hosted coverage (homarr-labs)
 *
 * Usage:
 *   node scripts/fetch-icons.mjs              # all services
 *   node scripts/fetch-icons.mjs postgres redis grafana
 *   node scripts/fetch-icons.mjs --dry-run    # preview URLs, no writes
 *   node scripts/fetch-icons.mjs --list       # show mapping table
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_ROOT = path.resolve(__dirname, '../public/catalog');

const SI_CDN = 'https://cdn.simpleicons.org';
const SELFHST_CDN = 'https://cdn.jsdelivr.net/gh/selfhst/icons@main/svg';
const DASH_CDN = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg';

/**
 * service-id → [source, slug]
 * Add new services here as the catalog grows.
 * To use a PNG from selfh.st instead: change extension in slug and handle separately.
 */
const ICON_SOURCES = {
'authentik':        ['si',      'authentik'],
  'artifactory':       ['si',      'jfrog'],
  'authelia':          ['selfhst', 'authelia'],
  'caddy':            ['si',      'caddy'],
  'chroma':           ['dash',   'chroma'],
  'clickhouse':       ['si',      'clickhouse'],
  'duckdb':          ['si',      'duckdb'],
  'element':          ['si',      'element'],
  'falkordb':        ['si',      'falkordb'],
  'forgejo':         ['selfhst', 'forgejo'],
  'gitea':           ['si',     'gitea'],
  'gitlab':          ['si',     'gitlab'],
  'grafana':         ['si',     'grafana'],
  'home-assistant':   ['si',      'homeassistant'],
  'jellyfin':         ['si',      'jellyfin'],
  'jitsi':           ['si',      'jitsi'],
  'kafka':           ['si',      'apachekafka'],
  'kanidm':          ['selfhst', 'kanidm'],
  'keycloak':        ['si',      'keycloak'],
  'lldap':           ['selfhst', 'lldap'],
  'mariadb':         ['si',      'mariadb'],
  'matrix':         ['si',      'matrix'],
  'mattermost':     ['si',      'mattermost'],
  'mongodb':        ['si',      'mongodb'],
  'mosquitto':       ['selfhst', 'mosquitto'],
  'mumble':         ['si',      'mumble'],
  'mysql':           ['si',      'mysql'],
  'nats':            ['si',     'natsdotio'],
  'nexus':           ['si',      'sonatype'],
  'nextcloud':      ['si',      'nextcloud'],
  'nginx-proxy-manager': ['selfhst', 'nginx-proxy-manager'],
  'onedev':         ['selfhst', 'onedev'],
  'pihole':         ['si',      'pihole'],
  'postgres':       ['si',      'postgresql'],
  'pritunl':        ['dash',   'pritunl'],
  'prowlarr':       ['selfhst', 'prowlarr'],
  'qdrant':         ['si',      'qdrant'],
  'qbittorrent':    ['si',      'qbittorrent'],
  'rabbitmq':       ['si',      'rabbitmq'],
  'radarr':         ['selfhst', 'radarr'],
  'redis':          ['si',      'redis'],
  'rocket-chat':      ['selfhst', 'rocket-chat'],
  'matrix-synapse': ['si',      'matrix'],
  'element-web':    ['si',      'element'],
  'jitsi-meet':     ['si',      'jitsi'],
  'traefik':        ['si',      'traefikproxy'],
  'uptime-kuma':    ['selfhst', 'uptime-kuma'],
  'vaultwarden':    ['selfhst', 'vaultwarden'],
  'verdaccio':     ['selfhst', 'verdaccio'],
  'zitadel':       ['selfhst', 'zitadel'],
  'zulip':         ['si',      'zulip'],
  'appsmith':       ['si',      'appsmith'],
  'camunda':       ['si',      'camunda'],
  'erpnext':       ['si',      'erpnext'],
  'focalboard':    ['selfhst', 'focalboard'],
  'minio':        ['si',      'minio'],
  'odoo':         ['si',      'odoo'],
  'openproject':  ['si',      'openproject'],
  'plane':        ['si',      'plane'],
  'redmine':      ['si',      'redmine'],
  'seafile':      ['si',      'seafile'],
'step-ca':       ['selfhst', 'step-ca'],
  'infisical':     ['selfhst', 'infisical'],
  'vault':        ['si',      'hashicorp'],
  'drone-ci':       ['si',      'drone'],
  'gocd':          ['si',      'gocd'],
  'jenkins':       ['si',     'jenkins'],
  'woodpecker-ci': ['selfhst', 'woodpecker-ci'],
'prometheus':    ['si',      'prometheus'],
  'victoriametrics': ['selfhst', 'victoria-metrics'],
  'netdata':      ['si',      'netdata'],
  'zabbix':       ['selfhst', 'zabbix'],
  'checkmk':       ['si',      'checkmk'],
  'adguard-home': ['si',      'adguard'],
  'technitium-dns': ['selfhst', 'technitium'],
  'dnsmasq':      ['selfhst', 'dnsmasq'],
  'coredns':      ['selfhst', 'coredns'],
  'unbound':      ['selfhst', 'unbound'],
  'wg-easy':      ['si',      'wg-easy'],
  'headscale':   ['selfhst', 'headscale'],
  'netbird':     ['selfhst', 'netbird'],
  'openvpn':      ['si',      'openvpn'],
  'haproxy':      ['selfhst', 'haproxy'],
  'envoy':       ['selfhst', 'envoy'],
  'openresty':    ['selfhst', 'openresty'],
'loki':        ['selfhst', 'loki'],
  'seq':         ['selfhst', 'seq'],
  'vector':      ['selfhst', 'vector'],
'wikijs':       ['selfhst', 'wikijs'],
  'dokuwiki':    ['selfhst', 'dokuwiki'],
  'medwiki':     ['selfhst', 'mediawiki'],
  'plex':         ['si',      'plex'],
  'emby':        ['si',      'emby'],
  'navidrome':    ['selfhst', 'navidrome'],
  'audiobookshelf': ['selfhst', 'audiobookshelf'],
  'immich':       ['selfhst', 'immich'],
  'photoprism':   ['selfhst', 'photoprism'],
  'n8n':         ['si', 'n8n'],
  'node-red':     ['si', 'nodered'],
  'huginn':       ['selfhst', 'huginn'],
  'activepieces': ['selfhst', 'activepieces'],
  'windmill':     ['selfhst', 'windmill'],
  'tooljet':      ['selfhst', 'tooljet'],
  'budibase':     ['si', 'budibase'],
  'portainer':    ['si', 'portainer'],
  'yacht':       ['selfhst', 'yacht'],
  'dockge':      ['selfhst', 'dockge'],
  'caprover':    ['selfhst', 'caprover'],
  'komodo':     ['selfhst', 'komodo'],
  'opensearch':  ['si', 'opensearch'],
  'elasticsearch': ['si', 'elastic'],
  'solr':        ['dash', 'apache-solr'],
  'meilisearch': ['selfhst', 'meilisearch'],
  'typesense':   ['selfhst', 'typesense'],
  'zincsearch':  ['selfhst', 'zincsearch'],
  'quickwit':    ['selfhst', 'quickwit'],
  'owncloud':   ['si', 'owncloud'],
  'filebrowser': ['dash', 'filebrowser'],
  'sftpgp':    ['dash', 'sftpgo'],
  'wordpress': ['si', 'wordpress'],
  'ghost':     ['si', 'ghost'],
  'strapi':    ['si', 'strapi'],
  'directus':  ['selfhst', 'directus'],
  'payload':   ['selfhst', 'payload'],
  'grav':      ['selfhst', 'grav'],
  'drupal':   ['si', 'drupal'],
  'openwebui':  ['selfhst', 'open-webui'],
  'anythingllm': ['dash', 'anything-llm'],
  'librechat': ['selfhst', 'librechat'],
  'flowise':    ['selfhst', 'flowise'],
  'dify':      ['selfhst', 'dify'],
  'langflow':   ['selfhst', 'langflow'],
  'ollama':     ['selfhst', 'ollama'],
  'localai':    ['dash', 'localai'],
  'vllm':       ['dash', 'vllm'],
  'text-generation-webui': ['dash', 'text-generation-webui'],
  'litellm':    ['selfhst', 'litellm'],
  'llama-cpp-server': ['selfhst', 'llama-cpp'],
'searxng':     ['selfhst', 'searxng'],
  'comfyui':     ['si', 'comfy'],
  'invokeai':    ['si', 'invoke'],
};

function iconUrl(source, slug) {
  if (source === 'si') return `${SI_CDN}/${slug}`;
  if (source === 'selfhst') return `${SELFHST_CDN}/${slug}.svg`;
  return `${DASH_CDN}/${slug}.svg`;
}

async function fetchSvg(source, slug) {
  const url = iconUrl(source, slug);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const text = await res.text();
  if (!text.trimStart().startsWith('<svg') && !text.includes('<svg')) {
    throw new Error(`Not an SVG (${text.slice(0, 60)}…)`);
  }
  return { text, url };
}

async function processService(id, { dryRun }) {
  const entry = ICON_SOURCES[id];
  if (!entry) {
    console.log(`  ?  ${id}: no source defined — skipping`);
    return;
  }

  const [source, slug] = entry;
  const dest = path.join(CATALOG_ROOT, id, 'icon.svg');

  try {
    const { text, url } = await fetchSvg(source, slug);

    if (dryRun) {
      console.log(`  ✓  ${id.padEnd(22)} ${url}`);
      return;
    }

    fs.writeFileSync(dest, text, 'utf-8');
    console.log(`  ✓  ${id.padEnd(22)} ${url} (${text.length} B)`);
  } catch (err) {
    console.log(`  ✗  ${id.padEnd(22)} ${err.message}`);
  }
}

function printList() {
  const rows = Object.entries(ICON_SOURCES).map(([id, [source, slug]]) => ({
    id: id.padEnd(22),
    source: source.padEnd(8),
    url: iconUrl(source, slug),
  }));
  console.log('SERVICE'.padEnd(22) + 'SOURCE'.padEnd(8) + 'URL');
  console.log('-'.repeat(90));
  rows.forEach(r => console.log(`${r.id}${r.source}${r.url}`));
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    printList();
    return;
  }

  const dryRun = args.includes('--dry-run');
  const targets = args.filter(a => !a.startsWith('--'));
  const ids = targets.length > 0 ? targets : Object.keys(ICON_SOURCES);

  const unknown = targets.filter(id => !fs.existsSync(path.join(CATALOG_ROOT, id)));
  if (unknown.length) {
    console.warn(`Warning: no catalog directory for: ${unknown.join(', ')}`);
  }

  console.log(`Fetching ${ids.length} icon(s)${dryRun ? ' [dry-run]' : ''}...\n`);

  for (const id of ids) {
    await processService(id, { dryRun });
  }

  console.log('');
  if (!dryRun) {
    console.log('Icons written. Run "bun run build:dev" to verify the build.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
