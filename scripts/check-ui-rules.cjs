const fs = require('fs');
const path = require('path');

const root = process.cwd();
const sourceRoots = ['src/features', 'src/components/layout'];
const ignoredDirs = new Set(['node_modules', 'dist']);

const rules = [
  {
    name: 'raw-controls',
    pattern: /<(button|input|select|textarea)\b/g,
    message: 'Use shadcn/ui controls from src/components/ui in feature/layout code.',
    baseline: {
      'src/features/builder/BuilderView.tsx': 1,
      'src/features/builder/components/PreviewPanel.tsx': 3,
      'src/features/builder/components/sections/EnvironmentSection.tsx': 4,
      'src/features/builder/components/sections/LabelsSection.tsx': 3,
      'src/features/builder/components/sections/NetworkSection.tsx': 7,
      'src/features/builder/components/sections/RuntimeSection.tsx': 3,
      'src/features/builder/components/sections/StorageSection.tsx': 5,
    },
  },
  {
    name: 'raw-colors',
    pattern: /\b(?:bg|text|border|ring|from|via|to)-(?:gray|zinc|slate|neutral|red|blue|green|yellow|orange|amber|indigo|violet|purple|black|white)-[0-9]{2,3}(?:\/[0-9]+)?\b|#[0-9a-fA-F]{3,8}|rgba?\(/g,
    message: 'Use CSS variable tokens instead of raw Tailwind color families or inline colors.',
    baseline: {
      'src/features/builder/components/PreviewPanel.tsx': 4,
      'src/features/builder/components/ServiceList.tsx': 2,
      'src/features/builder/components/StackSettings.tsx': 6,
      'src/features/builder/components/sections/NetworkSection.tsx': 7,
      'src/features/builder/components/sections/StorageSection.tsx': 10,
      'src/features/host/components/BundleLauncher.tsx': 8,
    },
  },
  {
    name: 'typography-drift',
    pattern: /\b(?:font-black|font-extrabold|text-(?:2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl))\b/g,
    message: 'Avoid heavy or oversized typography outside explicitly scoped page-level work.',
    baseline: {
      'src/components/layout/AppLayout.tsx': 3,
      'src/components/layout/ComposeList.tsx': 2,
      'src/features/builder/BuilderView.tsx': 5,
      'src/features/builder/components/PreviewPanel.tsx': 1,
      'src/features/builder/components/ServiceList.tsx': 4,
      'src/features/builder/components/StackSettings.tsx': 15,
      'src/features/builder/components/sections/EnvironmentSection.tsx': 1,
      'src/features/builder/components/sections/NetworkSection.tsx': 7,
      'src/features/builder/components/sections/RuntimeSection.tsx': 4,
      'src/features/builder/components/sections/StorageSection.tsx': 1,
      'src/features/host/HostDetailView.tsx': 15,
      'src/features/host/HostListView.tsx': 3,
      'src/features/host/components/BundleLauncher.tsx': 8,
      'src/features/host/components/HostCard.tsx': 4,
    },
  },
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function toRepoPath(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

const files = sourceRoots.flatMap((dir) => walk(path.join(root, dir)));
const failures = [];

for (const file of files) {
  const repoPath = toRepoPath(file);
  const content = fs.readFileSync(file, 'utf8');

  for (const rule of rules) {
    const matches = content.match(rule.pattern) || [];
    const allowed = rule.baseline[repoPath] || 0;

    if (matches.length > allowed) {
      failures.push(`${repoPath}: ${rule.name} ${matches.length}/${allowed}. ${rule.message}`);
    }
  }
}

if (failures.length > 0) {
  console.error('UI rule guard failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('UI rule guard passed.');
