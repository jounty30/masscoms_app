const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix @babel/runtime resolution for @tanstack/query-core (Metro sometimes fails to find it)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@babel/runtime')) {
    try {
      const resolved = require.resolve(moduleName, { paths: [path.join(__dirname, 'node_modules')] });
      return { type: 'sourceFile', filePath: resolved };
    } catch {
      // fall through to default
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
