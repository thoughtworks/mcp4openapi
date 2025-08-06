import fs from 'fs';
import path from 'path';

// Interface for package.json structure
interface PackageInfo {
  name: string;
  version: string;
  description?: string;
}

let packageInfo: PackageInfo | null = null;

/**
 * Reads and caches package.json information
 */
function loadPackageInfo(): PackageInfo {
  if (packageInfo) {
    return packageInfo;
  }

  try {
    // Look for package.json in the project root
    // Try multiple possible locations to be robust
    const possiblePaths = [
      path.resolve(process.cwd(), 'package.json'),
      path.resolve(__dirname, '..', 'package.json'),
      path.resolve(__dirname, '..', '..', 'package.json')
    ];
    
    let packageJsonPath: string | null = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        packageJsonPath = possiblePath;
        break;
      }
    }
    
    if (!packageJsonPath) {
      throw new Error('package.json not found');
    }
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    
    packageInfo = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description
    };
    
    return packageInfo;
  } catch (error) {
    // Fallback to hardcoded values if package.json can't be read
    console.warn('Warning: Could not read package.json, using fallback values');
    packageInfo = {
      name: 'mcp-openapi-server',
      version: '1.0.0',
      description: 'MCP OpenAPI Server'
    };
    return packageInfo;
  }
}

// Export the package information
export const PACKAGE_NAME = loadPackageInfo().name;
export const PACKAGE_VERSION = loadPackageInfo().version;
export const PACKAGE_DESCRIPTION = loadPackageInfo().description;

// Export function for getting full package info
export function getPackageInfo(): PackageInfo {
  return loadPackageInfo();
}