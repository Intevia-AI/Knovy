#!/bin/bash

# Environment Setup Script for Intevia AI Monorepo
# This script copies .env.example files to .env for all applications

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to prompt for user confirmation
confirm() {
    while true; do
        read -p "$1 (y/n): " yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes (y) or no (n).";;
        esac
    done
}

# Function to copy .env.example to .env with validation
setup_env_file() {
    local app_path=$1
    local app_name=$2
    
    print_status "Setting up environment for $app_name..."
    
    # Check if .env.example exists
    if [ ! -f "$app_path/.env.example" ]; then
        print_error ".env.example not found in $app_path"
        return 1
    fi
    
    # Check if .env already exists
    if [ -f "$app_path/.env" ]; then
        print_warning ".env file already exists in $app_path"
        if confirm "Do you want to overwrite the existing .env file?"; then
            cp "$app_path/.env.example" "$app_path/.env"
            print_success "Overwritten .env file for $app_name"
        else
            print_status "Skipped $app_name (keeping existing .env)"
        fi
    else
        cp "$app_path/.env.example" "$app_path/.env"
        print_success "Created .env file for $app_name"
    fi
}

# Main script execution
main() {
    echo "=================================================="
    echo "  Intevia AI Environment Setup Script"
    echo "=================================================="
    echo ""
    
    print_status "This script will copy .env.example files to .env for all applications"
    echo ""
    
    # Check if we're in the correct directory (should have apps/ folder)
    if [ ! -d "apps" ]; then
        print_error "apps/ directory not found. Please run this script from the project root."
        exit 1
    fi
    
    # Create scripts directory if it doesn't exist
    mkdir -p scripts
    
    # Setup environment files for each application
    local success_count=0
    local total_count=3
    
    # App (Electron)
    if setup_env_file "apps/app" "Electron App"; then
        ((success_count++))
    fi
    
    # Web (Next.js)
    if setup_env_file "apps/web" "Web Application"; then
        ((success_count++))
    fi
    
    # Proxy Server
    if setup_env_file "apps/proxy" "Proxy Server"; then
        ((success_count++))
    fi
    
    echo ""
    echo "=================================================="
    print_status "Environment setup completed!"
    print_status "Successfully configured $success_count out of $total_count applications"
    echo ""
    
    if [ $success_count -eq $total_count ]; then
        print_success "All applications are ready for development!"
        echo ""
        print_status "Next steps:"
        echo "  1. Edit the .env files in each app directory with your actual values"
        echo "  2. Refer to the comments in each .env file for guidance on obtaining API keys"
        echo "  3. Run 'pnpm install' to install dependencies"
        echo "  4. Start development with 'pnpm dev' in each app directory"
    else
        print_warning "Some applications may need manual environment setup"
        echo "  Please check the error messages above and resolve any issues"
    fi
    
    echo ""
    echo "=================================================="
}

# Run main function
main "$@"