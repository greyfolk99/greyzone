# Greyzone (gz)

Stop AI agents from corrupting your `.env` files.

## Why?

AI agents (Claude, Cursor, etc.) often corrupt `.env` files during development:
- Overwriting with `cat >` or `echo >`
- Accidentally deleting or modifying values
- Exposing secrets in logs or conversations

**Greyzone solves this by:**
- Storing env vars in encrypted SQLite DB (no `.env` file to corrupt)
- Project-local and global scope with profile support (dev/staging/prod)
- Locked protection for critical secrets (`sudo gz set --locked`)
- History tracking with undo/rollback support
- MCP integration for AI agent access (with safeguards)
- Direct push to GitHub Secrets

## How Locked Protection Works

Locked variables require sudo to write but are readable by anyone:
- **Readable by all**: AI agents can read locked values via `gz get`
- **Writable only by root**: Only `sudo gz set --locked` can create/modify them
- **Override blocked**: Cannot set a user value if a locked value exists for that key

This means:
1. Store critical secrets with `sudo gz set API_KEY secret --locked`
2. AI agents can use them but cannot modify or delete them
3. Locked values take priority over user values with the same key

> **Important:** AI agents must NOT have sudo access for this protection to work.

## Installation

```bash
npm install -g greyzone
```

## Quick Start

```bash
# Initialize project (creates .greyzone/ in current directory)
gz init myproject

# Set environment variables
gz set API_KEY sk-xxx
gz set DATABASE_URL postgres://...

# Skip confirmation with -y
gz set API_KEY sk-xxx -y

# Get a variable
gz get API_KEY

# List all keys
gz list

# Export for shell
eval $(gz export)

# Push to GitHub secrets
gz github --account myuser --repo owner/repo
gz push API_KEY DATABASE_URL
```

## Configuration

### Project Config (`.greyzone/config.yml`)

Created by `gz init`. You can edit this file directly.

```yaml
project: myproject
github:
  account: username      # Your GitHub username
  repo: owner/repo       # Target repository for secrets
```

### Storage Structure

```
.greyzone/                       # Local project (in project root)
├── config.yml                   # Project config (see above)
├── default/
│   ├── store.db                 # User variables (encrypted)
│   └── locked.db                # Locked variables (encrypted, requires sudo)
└── <profile>/
    ├── store.db
    └── locked.db

~/.greyzone/                     # Global scope
├── master.key                   # Encryption key (auto-generated)
├── config.yml                   # Global config (optional)
├── default/
│   ├── store.db
│   └── locked.db
└── <profile>/
    ├── store.db
    └── locked.db
```

### Encryption

- All `.db` files are encrypted with SQLCipher (AES-256)
- Encryption key is stored in `~/.greyzone/master.key` (mode 0400)
- Key is auto-generated on first use

### Priority Order (highest to lowest)

1. Local locked profile (`.greyzone/<profile>/locked.db`)
2. Local locked default (`.greyzone/default/locked.db`)
3. Global locked profile (`~/.greyzone/<profile>/locked.db`)
4. Global locked default (`~/.greyzone/default/locked.db`)
5. Local user profile (`.greyzone/<profile>/store.db`)
6. Local user default (`.greyzone/default/store.db`)
7. Global user profile (`~/.greyzone/<profile>/store.db`)
8. Global user default (`~/.greyzone/default/store.db`)

## CLI Commands

### Project Management

```bash
gz init <project>              # Initialize project in current directory
gz current                     # Show current project/profile info
gz current -g                  # Show global scope info
```

### Environment Variables

```bash
gz set KEY value               # Set variable (prompts confirmation)
gz set KEY value -y            # Skip confirmation
gz set KEY value -g            # Set in global scope
gz set KEY value --profile dev # Set in specific profile

gz get KEY                     # Get variable value
gz get KEY -g                  # Get from global scope
gz get KEY --profile dev       # Get from specific profile

gz list                        # List all keys with values
gz list -g                     # List global keys

gz delete KEY                  # Delete variable
gz delete KEY -y               # Skip confirmation
```

### Locked Variables (Protected)

```bash
# Write (requires sudo)
sudo gz set KEY value --locked
sudo gz delete KEY --locked -y

# Read (no sudo needed)
gz get KEY                     # Returns locked value if exists
gz list                        # Shows locked keys
```

### Version Control

```bash
gz log                         # Show change history
gz log KEY                     # History for specific key
gz log --all                   # History from all profiles

gz undo                        # Undo last change
gz undo -y                     # Skip confirmation

gz rollback -y -- -1           # Rollback 1 step
gz rollback "2024-01-01 12:00:00"  # Rollback to datetime

gz diff "2024-01-01 00:00:00" "2024-01-02 00:00:00"  # Changes between times
```

### Import/Export

```bash
gz export                      # Print as export statements
gz export -o .env              # Write to file
gz export -k KEY1 KEY2         # Export specific keys only

gz import .env                 # Import from file
gz import .env -y              # Skip confirmation
gz import .env -k KEY1         # Import specific keys only
```

### GitHub Integration

```bash
# Configure GitHub for project
gz github --account <username> --repo <owner/repo>
gz github                      # Show current config

# Push to GitHub secrets
gz push KEY1 KEY2              # Push specific keys
gz push KEY1 -y                # Skip confirmation
```

## MCP Server

### Setup

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "greyzone": {
      "command": "npx",
      "args": ["-y", "greyzone", "mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `get_context` | Get current local project context |
| `list_profiles` | List all profiles |
| `set_env` | Set environment variable (blocked if locked key exists) |
| `get_env` | Get environment variable value |
| `list_env` | List all keys (values hidden for security) |
| `delete_env` | Delete environment variable |
| `get_log` | Get change history |
| `rollback` | Rollback to datetime or -N steps |
| `push_to_github` | Push keys to GitHub secrets (requires confirm: true) |

### Security

- `list_env` returns keys only, not values
- `set_env` is blocked if the key exists in locked store
- `push_to_github` requires explicit `confirm: true` parameter
- Token account must match configured GitHub account

## Test

```bash
# Run all feature tests
./test.sh
```

## License

MIT
