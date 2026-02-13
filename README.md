# VibeTunnel 🚇

<p align="center">
  <img src="assets/banner.png" alt="VibeTunnel Banner" />
</p>

<p align="center">
  <strong>Turn any browser into your terminal.</strong><br>
  VibeTunnel proxies your terminals right into the browser for remote access and monitoring.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green" alt="License"></a>
  <img src="https://img.shields.io/badge/Linux-Supported-brightgreen" alt="Linux Support">
  <img src="https://img.shields.io/badge/Node.js-22.12%2B-339933?logo=node.js" alt="Node.js 22.12+">
</p>

## Table of Contents

- [Why VibeTunnel?](#why-vibetunnel)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Features](#features)
- [Architecture](#architecture)
- [Remote Access Options](#remote-access-options)
- [Git Follow Mode](#git-follow-mode)
- [Terminal Title Management](#terminal-title-management)
- [Authentication](#authentication)
- [Building from Source](#building-from-source)
- [Development](#development)
- [Poltergeist Integration](#poltergeist-integration)
- [Documentation](#documentation)
- [License](#license)

## Why VibeTunnel?

Ever wanted to check on your AI agents while you're away? Need to monitor that long-running build from your phone? Want to share a terminal session with a colleague without complex SSH setups? VibeTunnel makes it happen with zero friction.

## Installation

Install VibeTunnel via npm:

```bash
npm install -g vibetunnel
```

This gives you the full VibeTunnel server with web UI for Linux systems.

## Quick Start

### Requirements

Works on any system with Node.js 22.12+.

### 1. Install VibeTunnel

```bash
npm install -g vibetunnel
```

### 2. Launch VibeTunnel

Start the VibeTunnel server:

```bash
vibetunnel
```

### 3. Use the `vt` Command

The `vt` command is a smart wrapper that forwards your terminal sessions through VibeTunnel:

**How it works**:
- `vt` is a bash script that internally calls `vibetunnel fwd` to forward terminal output
- It provides additional features like shell alias resolution and session title management
- Installed globally with the npm package

```bash
# Run any command in the browser
vt pnpm run dev
vt npm test
vt python script.py

# Use your shell aliases
vt gs              # Your 'git status' alias works!
vt claude-danger   # Custom aliases are resolved

# Open an interactive shell
vt --shell         # or vt -i

# Git follow mode
vt follow          # Follow current branch
vt follow main     # Switch to main and follow
vt unfollow       # Stop following

# For more examples and options, see "The vt Forwarding Command" section below
```

### 4. Open Your Dashboard

Visit [http://localhost:4020](http://localhost:4020) to see all your terminal sessions.

## Features

- **🌐 Browser-Based Access** - Control your terminal from any device with a web browser
- **🚀 Zero Configuration** - No SSH keys, no port forwarding, no complexity
- **🤖 AI Agent Friendly** - Perfect for monitoring Claude Code, ChatGPT, or any terminal-based AI tools
- **📊 Session Activity Indicators** - Real-time activity tracking shows which sessions are active or idle
- **🔄 Git Follow Mode** - Terminal automatically follows your IDE's branch switching
- **⌨️ Smart Keyboard Handling** - Intelligent shortcut routing with toggleable capture modes. When capture is active, use Ctrl+1...9/0 to quickly switch between sessions
- **🔒 Secure by Design** - Multiple authentication modes, localhost-only mode, or secure tunneling via Tailscale/ngrok
- **📱 Mobile Ready** - Responsive web interface for phones and tablets
- **🎬 Session Recording** - All sessions recorded in asciinema format for later playback
- **⚡ High Performance** - Optimized Node.js server with minimal resource usage
- **🐚 Shell Alias Support** - Your custom aliases and shell functions work automatically

## Architecture

VibeTunnel consists of two main components:

1. **Node.js Server** - High-performance TypeScript server handling terminal sessions
2. **Web Frontend** - Modern web interface using Lit components and ghostty-web

The server runs as a standalone Node.js executable with embedded modules, providing excellent performance and minimal resource usage.

## Remote Access Options

### Option 1: Tailscale (Recommended)

[Tailscale](https://tailscale.com) creates a secure peer-to-peer VPN network between your devices. It's the most secure option as traffic stays within your private network without exposing VibeTunnel to the public internet.

**How it works**: Tailscale creates an encrypted WireGuard tunnel between your devices, allowing them to communicate as if they were on the same local network, regardless of their physical location.

#### Basic Setup
1. Install Tailscale on your Linux machine: [All Downloads](https://tailscale.com/download)
2. Install Tailscale on your remote device:
   - **Android**: [Download from Google Play](https://play.google.com/store/apps/details?id=com.tailscale.ipn)
   - **Other platforms**: [All Downloads](https://tailscale.com/download)
3. Sign in to both devices with the same account
4. If using VibeTunnel's Tailscale Serve integration, ensure Tailscale Serve is enabled in your [tailnet settings](https://login.tailscale.com/f/serve)
5. Find your machine's Tailscale hostname in the Tailscale CLI (e.g., `my-machine.tailnet-name.ts.net`)
6. Access VibeTunnel at `http://[your-tailscale-hostname]:4020`

#### Enhanced Tailscale Features

VibeTunnel now supports advanced Tailscale integration with **Private** and **Public** access modes:

##### Private Mode (Default)
- **What it does**: Provides secure HTTPS access within your Tailscale network only
- **Access URL**: `https://[your-machine-name].[tailnet-name].ts.net`
- **Security**: Traffic stays within your private tailnet
- **Best for**: Personal use, accessing your terminals from your own devices

##### Public Mode (Tailscale Funnel)
- **What it does**: Exposes VibeTunnel to the public internet via Tailscale Funnel
- **Access URL**: Same as Private mode but accessible from anywhere
- **Security**: Still uses HTTPS encryption, but accessible without Tailscale login
- **Best for**: Sharing terminal sessions with colleagues, temporary public access
- **Requirements**: Funnel must be enabled on your tailnet (see configuration below)

#### Configuring Tailscale Funnel

To use Public mode, you need to enable Funnel on your tailnet:

1. **Enable Funnel for your tailnet** by adding this ACL policy in the [Tailscale Admin Console](https://login.tailscale.com/admin/acls):
   ```json
   "nodeAttrs": [
       {
           "target": ["autogroup:member"], // All members of your tailnet
           "attr":   ["funnel"], 
       },
   ],
   ```

2. **Switch between modes** in VibeTunnel:
   - Open VibeTunnel Settings → Remote Access
   - Toggle between "Private (Tailnet Only)" and "Public (Internet)"
   - The UI will show the transition status and confirm when the mode is active

#### HTTPS Support

Both Private and Public modes automatically provide **HTTPS access**:
- Tailscale Serve creates an HTTPS proxy to VibeTunnel's local server
- SSL certificates are managed automatically by Tailscale
- No manual certificate configuration needed
- WebSocket connections work seamlessly over HTTPS/WSS

**Benefits**:
- **End-to-end encrypted** traffic
- **Automatic HTTPS** with valid certificates  
- **Works behind NAT** and firewalls
- **Zero configuration** after initial setup
- **Flexible access control** - choose between private tailnet or public internet access
- **No port forwarding** required

#### Troubleshooting

**"Tailscale Serve unavailable - using fallback mode"**: This is normal if you don't have Tailscale admin permissions. VibeTunnel will work perfectly using direct HTTP access at `http://[your-tailscale-hostname]:4020`.

**"Applying mode configuration..."**: When switching between Private and Public modes, it may take a few seconds for Tailscale to reconfigure. This is normal.

**"Funnel requires admin permissions"**: You need to be a tailnet admin to enable Funnel. Contact your tailnet admin or create your own tailnet if needed.

**WebSocket connections fail**: Make sure you're using the HTTPS URL when accessing VibeTunnel through Tailscale Serve. The WebSocket authentication tokens are automatically handled.

### Option 2: ngrok

[ngrok](https://ngrok.com) creates secure tunnels to your localhost, making VibeTunnel accessible via a public URL. Perfect for quick sharing or temporary access.

**How it works**: ngrok establishes a secure tunnel from a public endpoint to your local VibeTunnel server, handling SSL/TLS encryption and providing a unique URL for access.

**Setup Guide**:
1. Create a free ngrok account: [Sign up for ngrok](https://dashboard.ngrok.com/signup)
2. Copy your auth token from the [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Add the token in VibeTunnel settings (Settings → Remote Access → ngrok)
4. Enable ngrok tunneling in VibeTunnel
5. Share the generated `https://[random].ngrok-free.app` URL

**Benefits**:
- Public HTTPS URL with SSL certificate
- No firewall configuration needed
- Built-in request inspection and replay
- Custom domains available (paid plans)

**Note**: Free ngrok URLs change each time you restart the tunnel. You can claim one free static domain per user, or upgrade to a paid plan for multiple domains.

### Option 3: Local Network
1. Configure authentication (see Authentication section)
2. Switch to "Network" mode
3. Access via `http://[your-machine-ip]:4020`

### Option 4: Cloudflare Quick Tunnel
1. Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
2. Run `cloudflared tunnel --url http://localhost:4020`
3. Access via the generated `*.trycloudflare.com` URL

## Git Follow Mode

Git Follow Mode keeps your main repository checkout synchronized with the branch you're working on in a Git worktree. This allows agents to work in worktrees while your IDE, server, and other tools stay open on the main repository - they'll automatically update when the worktree switches branches.

### What is Follow Mode?

Follow mode creates a seamless workflow for agent-assisted development:
- Agents work in worktrees → Main repository automatically follows their branch switches
- Keep your IDE open → It updates automatically without reopening projects
- Server stays running → No need to restart servers in different folders
- Zero manual intervention → Main repo stays in sync with active development

### Quick Start

```bash
# From a worktree - enable follow mode for this worktree
vt follow

# From main repo - follow current branch's worktree (if it exists)
vt follow

# From main repo - follow a specific branch's worktree
vt follow feature/new-api

# From main repo - follow a worktree by path
vt follow ~/project-feature

# Disable follow mode
vt unfollow
```

### How It Works

1. **Git Hooks**: VibeTunnel installs lightweight Git hooks (post-commit, post-checkout) in worktrees that detect branch changes
2. **Main Repo Sync**: When you switch branches in a worktree, the main repository automatically checks out to the same branch
3. **Smart Handling**: If the main repo has uncommitted changes, follow mode pauses to prevent data loss
4. **Development Continuity**: Your IDE, servers, and tools running on the main repo seamlessly follow your active work
5. **Clean Uninstall**: When you run `vt unfollow`, Git hooks are automatically removed and any original hooks are restored

### Common Workflows

#### Agent Development with Worktrees
```bash
# Create a worktree for agent development
git worktree add ../project-agent feature/new-feature

# Enable follow mode on the main repo
cd ../project && vt follow

# Agent works in the worktree while you stay in main repo
# When agent switches branches in worktree, your main repo follows!
# Your IDE and servers stay running without interruption
```


### Technical Details

Follow mode stores the worktree path in your main repository's Git config:
```bash
# Check which worktree is being followed
git config vibetunnel.followWorktree

# Follow mode is active when this returns a path
# The config is managed by vt commands - manual editing not recommended
```

For more advanced Git worktree workflows, see our [detailed worktree documentation](docs/worktree.md).

## Terminal Title Management

VibeTunnel provides terminal title management to help you track sessions:

### Title Modes

- **Static Mode**: Shows working directory and command
  - Example: `~/projects/app — npm run dev`
- **Filter Mode**: Blocks all title changes from applications
  - Useful when you have your own terminal management system
- **None Mode**: No title management - applications control their own titles

### Activity Detection

Activity indicators are based on recent input/output and drive active/idle UI states.

## Authentication

VibeTunnel provides multiple authentication modes to secure your terminal sessions:

### Authentication Modes

#### 1. System Authentication (Default)
Uses your operating system's native authentication:
- **Linux**: Uses PAM (Pluggable Authentication Modules)
- Login with your system username and password

#### 2. Environment Variable Authentication
Simple authentication for deployments:
```bash
export VIBETUNNEL_USERNAME=admin
export VIBETUNNEL_PASSWORD=your-secure-password
npm run start
```

#### 3. SSH Key Authentication
Use Ed25519 SSH keys from `~/.ssh/authorized_keys`:
```bash
# Enable SSH key authentication
npm run start -- --enable-ssh-keys

# Make SSH keys mandatory (disable password auth)
npm run start -- --enable-ssh-keys --disallow-user-password
```

#### 4. No Authentication
For trusted environments only:
```bash
npm run start -- --no-auth
```

#### 5. Local Bypass (Development Only)
Allow localhost connections to bypass authentication:
```bash
# Basic local bypass (DEVELOPMENT ONLY - NOT FOR PRODUCTION)
npm run start -- --allow-local-bypass

# With token for additional security (minimum for production)
npm run start -- --allow-local-bypass --local-auth-token mytoken
```

**Security Note**: Local bypass uses `req.socket.remoteAddress` which cannot be spoofed remotely due to TCP's three-way handshake. The implementation also rejects requests with proxy headers (`X-Forwarded-For`, etc.) to prevent header injection attacks. However:
- **Development only**: Basic bypass without token should never be used in production
- **Local processes**: Any process on the same machine can access the API
- **Always use tokens**: In production, always require `--local-auth-token`
- **Consider alternatives**: For production, use proper authentication instead of local bypass

### Security Best Practices

1. **Always use authentication** when binding to network interfaces (`--bind 0.0.0.0`)
2. **Use HTTPS** in production with a reverse proxy (nginx, Caddy)
3. **Rotate credentials** regularly
4. **Consider SSH keys** for stronger security
5. **Never use local bypass without tokens** in production environments
6. **Monitor access logs** for suspicious authentication patterns
7. **Default to secure** - explicitly enable less secure options only when needed

### SSH Key Authentication Troubleshooting

If SSH key generation fails with crypto errors, see the [detailed troubleshooting guide](web/README.md#ssh-key-authentication-issues) for solutions.


## The `vt` Forwarding Command

The `vt` command is VibeTunnel's terminal forwarding wrapper that allows you to run any command while making its output visible in the browser. Under the hood, `vt` is a convenient shortcut for `vibetunnel fwd` - it's a bash script that calls the full command with proper path resolution and additional features like shell alias support. The `vt` wrapper acts as a transparent proxy between your terminal and the command, forwarding all input and output through VibeTunnel's infrastructure.

#### Command Syntax

```bash
vt [options] <command> [args...]
```

#### Options

**Terminal Title Control:**
- `--title-mode <mode>` - Control how terminal titles are managed:
  - `none` - No title management, apps control their own titles (default)
  - `filter` - Block all title changes from applications
  - `static` - Show working directory and command in title

**Verbosity Control:**
- `-q, --quiet` - Quiet mode, no console output (logs to file only)
- `-v, --verbose` - Verbose mode, show errors, warnings, and info messages
- `-vv` - Extra verbose, show all messages except debug
- `-vvv` - Debug mode, show all messages including debug

**Other Options:**
- `--shell, -i` - Launch your current shell interactively
- `--no-shell-wrap, -S` - Execute command directly without shell interpretation
- `--log-file <path>` - Override default log file location (defaults to `~/.vibetunnel/log.txt`)
- `--help, -h` - Show help message with all options

#### Verbosity Levels

VibeTunnel uses a hierarchical logging system where each level includes all messages from more severe levels:

| Level | Flag | Environment Variable | Shows |
|-------|------|---------------------|-------|
| SILENT | `-q` | `VIBETUNNEL_LOG_LEVEL=silent` | No console output (file logging only) |
| ERROR | (default) | `VIBETUNNEL_LOG_LEVEL=error` | Errors only |
| WARN | - | `VIBETUNNEL_LOG_LEVEL=warn` | Errors and warnings |
| INFO | `-v` | `VIBETUNNEL_LOG_LEVEL=info` | Errors, warnings, and informational messages |
| VERBOSE | `-vv` | `VIBETUNNEL_LOG_LEVEL=verbose` | All messages except debug |
| DEBUG | `-vvv` | `VIBETUNNEL_LOG_LEVEL=debug` | Everything including debug traces |

**Note:** All logs are always written to `~/.vibetunnel/log.txt` regardless of verbosity settings. The verbosity only controls terminal output.

#### Examples

```bash
# Basic command forwarding
vt ls -la                    # List files with VibeTunnel monitoring
vt npm run dev              # Run development server
vt python script.py         # Execute Python script

# With verbosity control
vt -q npm test              # Run tests silently
vt -v npm install           # See detailed installation progress
vt -vvv python debug.py     # Full debug output
vt --log-file debug.log npm run dev  # Write logs to custom file

# Terminal title management
vt --title-mode static npm run dev     # Fixed title showing command
vt --title-mode filter vim             # Prevent vim from changing title

# Shell handling
vt --shell                  # Open interactive shell
vt -S /usr/bin/python      # Run python directly without shell
```

#### How It Works

1. **Command Resolution**: The `vt` wrapper first checks if your command is an alias, shell function, or binary
2. **Session Creation**: It creates a new VibeTunnel session with a unique ID
3. **PTY Allocation**: A pseudo-terminal is allocated to preserve terminal features (colors, cursor control, etc.)
4. **I/O Forwarding**: All input/output is forwarded between your terminal and the browser in real-time
5. **Process Management**: The wrapper monitors the process and handles signals, exit codes, and cleanup

#### Environment Variables

- `VIBETUNNEL_LOG_LEVEL` - Set default verbosity level (silent, error, warn, info, verbose, debug)
- `VIBETUNNEL_TITLE_MODE` - Set default title mode (none, filter, static)
- `VIBETUNNEL_DEBUG` - Legacy debug flag, equivalent to `VIBETUNNEL_LOG_LEVEL=debug`

#### Special Features

**Shell Alias Support**: Your shell aliases and functions work transparently through `vt`:
```bash
alias gs='git status'
vt gs  # Works as expected
```

**Session Title Updates**: Inside a VibeTunnel session, use `vt title` to update the session name:
```bash
vt title "Building Production Release"
```

### Package Contents

The npm package includes:
- Full VibeTunnel server with web UI
- CLI tools (`vibetunnel` and `vt` commands)
- Native PTY support via node-pty
- Pre-built binaries for common platforms

### Building the npm Package

For maintainers who need to build the npm package:

#### Unified Build (Multi-Platform by Default)
```bash
# Build with prebuilt binaries for all platforms
# Requires Docker for Linux cross-compilation
npm run build:npm
```

This creates prebuilt binaries for:
- Linux (x64, arm64) - Node.js 22, 23, 24

#### Build Options
```bash
# Current platform only (faster for development)
node scripts/build-npm.js --current-only

# Specific platform/architecture
node scripts/build-npm.js --platform darwin --arch arm64

# Skip Docker builds
node scripts/build-npm.js --no-docker
```

#### Publishing
```bash
# Test the package locally
npm pack

# Publish to npm
npm publish
```

## Building from Source

### Prerequisites
- Linux system
- Node.js 22.12+ (minimum supported version)

### Build Steps

```bash
# Clone the repository
git clone https://github.com/YOUR_ENTERPRISE/vibetunnel.git
cd vibetunnel

# Build the web server
cd web
pnpm install
pnpm run build

# Optional: Build with custom Node.js for smaller binary (46% size reduction)
# export VIBETUNNEL_USE_CUSTOM_NODE=YES
# node build-custom-node.js  # Build optimized Node.js (one-time, ~20 min)
# pnpm run build              # Will use custom Node.js automatically
```

### Custom Node.js Builds

VibeTunnel supports building with a custom Node.js for a 46% smaller executable (61MB vs 107MB):

```bash
# Build custom Node.js (one-time, ~20 minutes)
node build-custom-node.js

# Use environment variable for all builds
export VIBETUNNEL_USE_CUSTOM_NODE=YES
```

See [Custom Node Build Flags](docs/custom-node-build-flags.md) for detailed optimization information.

## Development

### Key Files
- **Server**: `web/src/server/` (TypeScript/Node.js)
- **Web UI**: `web/src/client/` (Lit/TypeScript)

### Testing & Code Coverage

VibeTunnel has comprehensive test suites with code coverage enabled:

```bash
# Web tests with coverage (Vitest)
cd web && ./scripts/coverage-report.sh
```

**Coverage Requirements**:
- Web: 80% minimum for lines, functions, branches, and statements

### Development Server & Hot Reload

VibeTunnel includes a development server with automatic rebuilding for faster iteration:

#### Development Mode

```bash
cd web
pnpm run dev
```

**What this provides:**
- **Automatic Rebuilds**: esbuild watches for file changes and rebuilds bundles instantly
- **Fast Feedback**: Changes are compiled within seconds of saving
- **Manual Refresh Required**: Browser needs manual refresh to see changes (no hot module replacement)

**How it works:**
- esbuild watch mode detects file changes in `src/`
- Automatically rebuilds JavaScript bundles and CSS
- Express server serves updated files immediately
- Visit `http://localhost:4020` and refresh to see changes

#### Testing on External Devices (iPad, iPhone, etc.)

When developing the web interface, you often need to test changes on external devices to debug browser-specific issues. Here's how to do it:

##### Quick Setup

1. **Run the dev server with network access**:
   ```bash
   cd web
   pnpm run dev --port 4021 --bind 0.0.0.0
   ```
   This binds to all network interfaces, making it accessible from other devices.

2. **Find your Mac's IP address**:
   - System Preferences → Network → Wi-Fi → Details
   - Or run: `ipconfig getifaddr en0`

3. **Access from your external device**:
   ```
   http://[your-mac-ip]:4021
   ```

##### Important Notes

- **Port conflict**: Use a different port (e.g., 4021) if port 4020 is already in use
- **Same network**: Ensure both devices are on the same Wi-Fi network
- **Firewall**: Allow incoming connections when prompted
- **Auto-rebuild**: Changes to the web code are automatically rebuilt, but you need to manually refresh the browser

##### Pasting on Mobile Devices

When using VibeTunnel on mobile browsers (Safari, Chrome), pasting works differently than on desktop:

**To paste on mobile:**
1. Press the paste button on the keyboard toolbar
2. A white input box will appear
3. Long-press inside the white box to bring up the paste menu
4. Select "Paste" from the menu
5. The text will be pasted into your terminal session

**Note**: Due to browser security restrictions on non-HTTPS connections, the paste API is limited on mobile devices. The white input box is a workaround that allows clipboard access through the browser's native paste functionality.

#### Future: Hot Module Replacement

For true hot module replacement without manual refresh, see our [Vite migration plan](docs/vite-plan.md) which would provide:
- Instant updates without page refresh
- Preserved application state during development
- Sub-second feedback loops
- Modern development tooling

#### Mac App Development Server Mode

The VibeTunnel Mac app includes a special development server mode that integrates with the web development workflow:

**Setup:**
1. Open VibeTunnel Settings → Debug tab (enable Debug Mode first in General settings)
2. Enable "Use Development Server"
3. Set the path to your `web/` directory
4. Restart the VibeTunnel server

**How it works:**
- Instead of using the bundled production server, the Mac app runs `pnpm run dev` in your web directory
- Provides hot reload and automatic rebuilding during development
- Maintains all Mac app functionality (session management, logging, etc.)
- Shows "Dev Server" in the menu bar and status indicators

**Benefits:**
- No need to manually rebuild after code changes
- Automatic esbuild watch mode for instant compilation
- Full integration with Mac app features
- Same terminal session management as production

**Alternative: Standalone Development**

If you prefer working outside the Mac app:

1. Build the web project: `cd web && pnpm run build`
2. In VibeTunnel settings, set Dashboard Access to "Network"
3. Access from external device: `http://[your-mac-ip]:4020`

Note: This requires rebuilding after each change, so the dev server mode above is preferred for rapid iteration.

### Debug Logging

Enable debug logging for troubleshooting:

```bash
# Enable debug mode
export VIBETUNNEL_DEBUG=1

# Or use inline
VIBETUNNEL_DEBUG=1 vt your-command
```

Debug logs are written to `~/.vibetunnel/log.txt`.

This is particularly useful for:
- Testing changes without installing to `/Applications`
- Working with multiple VibeTunnel builds simultaneously
- Quickly switching between development and production versions
- Debugging which version of VibeTunnel is being used

The version information is also:
- Stored in `session.json` for each session
- Displayed in `vt status` output
- Shown in the initial log output when `VIBETUNNEL_PREFER_DERIVED_DATA` is set

### Verbosity Control

Control the amount of output from VibeTunnel commands:

```bash
# Command-line flags
vt -q npm test                # Quiet mode - no console output
vt npm test                   # Default - errors only
vt -v npm run dev            # Verbose - errors, warnings, and info
vt -vv cargo build           # Extra verbose - all except debug
vt -vvv python script.py     # Debug mode - everything

# Environment variable
export VIBETUNNEL_LOG_LEVEL=error    # Default
export VIBETUNNEL_LOG_LEVEL=warn     # Show errors and warnings
export VIBETUNNEL_LOG_LEVEL=info     # Show errors, warnings, and info
export VIBETUNNEL_LOG_LEVEL=verbose  # All except debug
export VIBETUNNEL_LOG_LEVEL=debug    # Everything

# Or use inline
VIBETUNNEL_LOG_LEVEL=silent vt npm test
```

**Note**: All logs are always written to `~/.vibetunnel/log.txt` regardless of verbosity level. The verbosity settings only control what's displayed in the terminal.

## Poltergeist Integration

[Poltergeist](https://github.com/steipete/poltergeist) is an intelligent file watcher and auto-builder that can automatically rebuild VibeTunnel as you develop.

### Setting Up Poltergeist

1. **Install Poltergeist** (if not already installed):
   ```bash
   npm install -g poltergeist
   ```

2. **Start Poltergeist** in the VibeTunnel directory:
   ```bash
   cd /path/to/vibetunnel
   poltergeist
   ```

3. **Make changes** - Poltergeist will automatically rebuild when it detects changes to:
   - TypeScript/JavaScript files in `web/`
   - Configuration files

### Poltergeist Features

- **Automatic Rebuilds**: Detects file changes and rebuilds instantly
- **Smart Debouncing**: Prevents excessive rebuilds during rapid edits
- **Build Notifications**: Notifications for build success/failure

### Configuration

VibeTunnel includes a `poltergeist.config.json` that can be used to configure build targets and automation.

## Documentation

- [Keyboard Shortcuts](docs/keyboard-shortcuts.md) - Complete keyboard shortcut reference
- [Technical Specification](docs/spec.md) - Detailed architecture and implementation
- [Architecture](docs/architecture.md) - System design overview
- [Build System](docs/build-system.md) - Build process details
- [Push Notifications](docs/push-notification.md) - How web push notifications work

## License

VibeTunnel is open source software licensed under the MIT License. See [LICENSE](LICENSE) for details.
