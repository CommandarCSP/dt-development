const META_REGEX = /<!-- lastSyncedAt: ([^,]+), packageJsonMtime: ([^ ]+) -->/;

export function parseMetaHeader(markdown) {
  const m = markdown.match(META_REGEX);
  if (!m) return { lastSyncedAt: null, packageJsonMtime: null };
  return { lastSyncedAt: m[1].trim(), packageJsonMtime: m[2].trim() };
}

export function serializeMetaHeader({ lastSyncedAt, packageJsonMtime }) {
  return `<!-- Synced from package.json -->\n<!-- lastSyncedAt: ${lastSyncedAt}, packageJsonMtime: ${packageJsonMtime} -->`;
}

export function needsSync({ currentPkgMtime, storedPkgMtime }) {
  if (!storedPkgMtime) return true;
  return currentPkgMtime.getTime() > new Date(storedPkgMtime).getTime();
}
