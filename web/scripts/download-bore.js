#!/usr/bin/env node
/**
 * Download bore binaries from GitHub releases
 * 
 * This script downloads bore binaries for different platforms to support
 * the bore tunnel integration in VibeTunnel.
 * 
 * Bore releases: https://github.com/ekzhang/bore/releases
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const BORE_VERSION = 'v0.5.1';
const GITHUB_RELEASES_URL = 'https://github.com/ekzhang/bore/releases/download';

// Map platform/arch to bore release target names
// Note: v0.5.1 doesn't have aarch64-unknown-linux-musl (arm64 Linux)
// If you need arm64 Linux, consider upgrading to v0.6.0+ or building from source
const PLATFORMS = {
  'linux-x64': 'x86_64-unknown-linux-musl',
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
};

/**
 * Download a file from a URL
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(err);
    });
  });
}

/**
 * Extract tar.gz archive
 */
function extractTarGz(archivePath, destDir) {
  try {
    // Use tar command to extract
    execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: 'ignore' });
    return true;
  } catch (err) {
    console.error(`Failed to extract archive: ${err.message}`);
    return false;
  }
}

/**
 * Make file executable (Unix only)
 */
function makeExecutable(filePath) {
  if (os.platform() !== 'win32') {
    try {
      fs.chmodSync(filePath, 0o755);
      console.log(`Made executable: ${filePath}`);
    } catch (err) {
      console.error(`Warning: Could not make file executable: ${err.message}`);
    }
  }
}

/**
 * Download bore binary for a specific platform
 */
async function downloadBoreForPlatform(platformKey, target) {
  const binariesDir = path.join(__dirname, '..', 'binaries');
  const platformDir = path.join(binariesDir, `bore-${platformKey}`);
  const binaryPath = path.join(platformDir, 'bore');
  
  // Skip if already exists
  if (fs.existsSync(binaryPath)) {
    console.log(`Bore binary already exists for ${platformKey}, skipping...`);
    return;
  }
  
  // Create directories
  if (!fs.existsSync(binariesDir)) {
    fs.mkdirSync(binariesDir, { recursive: true });
  }
  if (!fs.existsSync(platformDir)) {
    fs.mkdirSync(platformDir, { recursive: true });
  }
  
  // Build download URL for tar.gz archive
  const archiveFilename = `bore-${BORE_VERSION}-${target}.tar.gz`;
  const url = `${GITHUB_RELEASES_URL}/${BORE_VERSION}/${archiveFilename}`;
  const archivePath = path.join(platformDir, archiveFilename);
  
  try {
    // Download the archive
    await downloadFile(url, archivePath);
    
    // Extract the archive
    if (!extractTarGz(archivePath, platformDir)) {
      throw new Error('Failed to extract archive');
    }
    
    // Remove the archive
    fs.unlinkSync(archivePath);
    
    // Make binary executable
    makeExecutable(binaryPath);
    
    console.log(`✓ Downloaded bore for ${platformKey}`);
  } catch (err) {
    console.error(`✗ Failed to download bore for ${platformKey}: ${err.message}`);
    // Clean up partial files
    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }
    if (fs.existsSync(binaryPath)) {
      fs.unlinkSync(binaryPath);
    }
    // Don't throw - allow other platforms to download
  }
}

/**
 * Main download function
 */
async function downloadBore() {
  console.log('Downloading bore binaries...');
  console.log(`Version: ${BORE_VERSION}`);
  console.log('');
  
  // Download for all supported platforms
  const downloads = Object.entries(PLATFORMS).map(([platformKey, target]) =>
    downloadBoreForPlatform(platformKey, target)
  );
  
  await Promise.all(downloads);
  
  console.log('');
  console.log('Bore binary download complete!');
}

// Run if executed directly
if (require.main === module) {
  downloadBore().catch((err) => {
    console.error('Error downloading bore binaries:', err);
    // Don't exit with error code - postinstall should not fail the installation
    process.exit(0);
  });
}

module.exports = { downloadBore };
