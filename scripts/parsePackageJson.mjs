export function parsePackageJson(pkg) {
  // devDependencies last-wins on duplicate keys (drop intentionally — rare in practice, LLM classifies the merged result).
  const dependencies = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };
  return {
    dependencies,
    packageManager: pkg.packageManager || null,
    nodeVersion: (pkg.engines && pkg.engines.node) || null
  };
}
