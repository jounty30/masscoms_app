#!/usr/bin/env node
/**
 * Workaround for iOS build looking for expo packages under node_modules/expo/node_modules/.
 * npm hoists them to node_modules/, so the build fails. This creates symlinks.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const expoNodeModules = path.join(root, 'node_modules', 'expo', 'node_modules');

const packages = ['expo-file-system', 'expo-font'];

for (const pkg of packages) {
  const source = path.join(root, 'node_modules', pkg);
  const targetDir = path.join(expoNodeModules, pkg);

  if (fs.existsSync(source) && !fs.existsSync(targetDir)) {
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.symlinkSync(source, targetDir, 'dir');
    console.log(`Created symlink: expo/node_modules/${pkg} -> ${pkg}`);
  }
}
