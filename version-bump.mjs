import { readFileSync, writeFileSync } from 'fs';

// Keeps manifest.json and versions.json in step with package.json.
// Run automatically by `npm version` (see the "version" script in package.json).
const targetVersion = process.env.npm_package_version;

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[targetVersion] = minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, 2) + '\n');
