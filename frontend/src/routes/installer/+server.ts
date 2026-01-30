import { text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Installer script endpoint
 * Serves a bash script that installs SelfHost.gg
 * Detected via curl User-Agent or explicit /installer route
 */
export const GET: RequestHandler = async ({ url, request }) => {
	const userAgent = request.headers.get('user-agent') || '';
	const isCurl = userAgent.toLowerCase().includes('curl');
	
	// Get the base URL for the installer to reference
	const protocol = url.protocol;
	const host = url.host;
	const baseUrl = `${protocol}//${host}`;
	
	const installerScript = `#!/bin/bash
set -e

echo "🚀 SelfHost.gg Installer"
echo "========================"
echo ""

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "Detected: $OS $ARCH"
echo ""

# Detect Linux distribution and install dependencies
if [ "$OS" = "Linux" ]; then
    echo "Detecting Linux distribution..."
    
    # Detect distribution
    if [ -f /etc/alpine-release ]; then
        DISTRO="alpine"
        PKG_MANAGER="apk"
        INSTALL_CMD="apk add"
    elif [ -f /etc/debian_version ]; then
        DISTRO="debian"
        PKG_MANAGER="apt-get"
        INSTALL_CMD="DEBIAN_FRONTEND=noninteractive apt-get install -y"
    elif [ -f /etc/redhat-release ] || [ -f /etc/centos-release ]; then
        if command -v dnf >/dev/null 2>&1; then
            DISTRO="rhel"
            PKG_MANAGER="dnf"
            INSTALL_CMD="dnf install -y"
        else
            DISTRO="rhel"
            PKG_MANAGER="yum"
            INSTALL_CMD="yum install -y"
        fi
    elif [ -f /etc/arch-release ]; then
        DISTRO="arch"
        PKG_MANAGER="pacman"
        INSTALL_CMD="pacman -S --noconfirm"
    else
        DISTRO="unknown"
        PKG_MANAGER=""
    fi
    
    if [ -n "$PKG_MANAGER" ]; then
        echo "Detected: $DISTRO (using $PKG_MANAGER)"
        
        # Check if running as root
        if [ "$EUID" -eq 0 ]; then
            SUDO=""
        else
            SUDO="sudo"
            if ! command -v sudo >/dev/null 2>&1; then
                echo "❌ Error: sudo is required but not installed. Please run as root or install sudo first."
                exit 1
            fi
        fi
        
        # Install dependencies based on distribution
        echo "Installing dependencies (git, curl, unzip)..."
        
        if [ "$DISTRO" = "alpine" ]; then
            $SUDO $INSTALL_CMD git curl unzip bash openssl
        elif [ "$DISTRO" = "debian" ]; then
            $SUDO $INSTALL_CMD git curl unzip bash openssl
        elif [ "$DISTRO" = "rhel" ]; then
            if [ "$PKG_MANAGER" = "dnf" ]; then
                $SUDO $INSTALL_CMD git curl unzip bash openssl
            else
                $SUDO $INSTALL_CMD git curl unzip bash openssl
            fi
        elif [ "$DISTRO" = "arch" ]; then
            $SUDO $INSTALL_CMD git curl unzip bash openssl
        fi
        
        echo "✓ Dependencies installed"
    else
        echo "⚠️  Unknown Linux distribution. Please ensure git, curl, unzip, bash, and openssl are installed."
    fi
    echo ""
fi

# Check for Bun
if command -v bun >/dev/null 2>&1; then
    echo "✓ Bun is already installed"
    BUN_PATH="$(command -v bun)"
else
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    BUN_PATH="$BUN_INSTALL/bin/bun"
fi

echo ""
echo "📦 Setting up SelfHost.gg..."
echo ""

# Create directory
INSTALL_DIR="$HOME/selfhost"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Clone or update repository
if [ -d ".git" ]; then
    echo "Updating existing installation..."
    git pull
else
    echo "Cloning SelfHost.gg repository..."
    git clone https://github.com/premoweb/selfhost.git .
fi

echo ""
echo "📥 Installing dependencies..."
"$BUN_PATH" install

echo ""
echo "🔧 Setting up environment..."
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env <<EOF
# SelfHost.gg Configuration
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
BETTER_AUTH_URL=${baseUrl}
PORT=3000
NODE_ENV=production
EOF
    echo "✓ Created .env file"
else
    echo "✓ .env file already exists"
fi

echo ""
echo "🗄️  Setting up database..."
"$BUN_PATH" run db:push || echo "Database already initialized"

echo ""
echo "✅ Installation complete!"
echo ""
echo "To start SelfHost.gg, run:"
echo "  cd $INSTALL_DIR"
echo "  bun run dev    # Development mode"
echo "  bun run build && bun run preview    # Production mode"
echo ""
echo "Or use the Dockerfile for containerized deployment."
echo ""
echo "📚 Documentation: ${baseUrl}/docs"
echo "💬 Support: https://discord.gg/6xPHaRGB95"
`;

	return text(installerScript, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Content-Disposition': 'inline; filename="install.sh"'
		}
	});
};
