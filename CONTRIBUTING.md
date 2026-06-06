# Contributing to Knovy

Thank you for your interest in contributing to Knovy! This document provides guidelines and workflows for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Workflow](#development-workflow)
- [Git Workflow](#git-workflow)
- [Coding Standards](#coding-standards)
- [Documentation Requirements](#documentation-requirements)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

We expect all contributors to adhere to the following principles:

- Be respectful and inclusive in all communications
- Provide constructive feedback
- Focus on what is best for the community and users
- Show empathy towards other community members

## Development Workflow

### Setting Up Your Development Environment

1. **Clone the repository**

   ```bash
   git clone https://github.com/Intevia-AI/Knovy.git
   cd Knovy
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up Supabase**

   ```bash
   supabase start
   supabase status  # Get API keys
   ```

4. **Set up environment variables**

   Copy `.env.example` to `.env` in each application directory:
   - `apps/app/.env`
   - `apps/web/.env`

   Fill in required API keys (Supabase).

5. **Start the development servers**

   For the desktop application (recommended):

   ```bash
   pnpm --filter app dev
   ```

   For the web application:

   ```bash
   pnpm --filter web dev
   ```

### Development Process

1. **Create a feature branch** from the `main` branch
2. **Implement your changes** with appropriate tests and documentation
3. **Run tests** to ensure your changes don't break existing functionality
4. **Submit a pull request** for review

## Git Workflow

We follow a feature branch workflow:

1. **Main Branch**: The `main` branch contains the stable, production-ready code
2. **Feature Branches**: Create a branch for each new feature or bug fix
3. **Pull Requests**: All changes must be submitted via pull requests
4. **Reviews**: Pull requests require at least one review before merging
5. **Continuous Integration**: All pull requests must pass CI checks

### Branch Naming Convention

- Feature branches: `feature/short-description`
- Bug fix branches: `fix/short-description`
- Documentation branches: `docs/short-description`
- Refactoring branches: `refactor/short-description`

### Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types include:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Example:

```
feat(web): add real-time transcription component

Implement real-time audio transcription using WebRTC and Web Audio API.
Includes unit tests and documentation.

Closes #123
```

## Coding Standards

### General Guidelines

- Write clean, readable, and maintainable code
- Follow the principle of DRY (Don't Repeat Yourself)
- Keep functions small and focused on a single responsibility
- Use meaningful variable and function names
- Add comments for complex logic, but prefer self-documenting code

### TypeScript Guidelines

- Use TypeScript for all new code
- Define explicit types for function parameters and return values
- Use interfaces for object shapes
- Avoid using `any` type when possible
- Use optional chaining and nullish coalescing when appropriate

### React Guidelines

- Use functional components with hooks (React 19)
- Keep components small and focused
- Use proper component composition
- Follow React best practices for performance optimization
- Use React context for state that needs to be shared across components

### Electron Guidelines

- Follow main/renderer process separation
- Use IPC for secure communication between processes
- Use preload scripts to expose limited APIs to renderer
- Store sensitive data in main process only
- Test cross-platform compatibility (macOS, Windows, Linux)

### Code Formatting

We use ESLint and Prettier for code formatting:

```bash
# Run linting
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

## Documentation Requirements

### Code Documentation

- Add JSDoc comments to all functions, classes, and complex variables
- Document parameters, return values, and thrown exceptions
- Include usage examples for complex functions or components
- Document any non-obvious behavior or edge cases

Example:

```typescript
/**
 * Processes audio data and extracts speech segments
 *
 * @param audioData - Raw audio buffer to process
 * @param options - Processing options
 * @returns Array of identified speech segments with timestamps
 * @throws {AudioProcessingError} If audio processing fails
 *
 * @example
 * const segments = processSpeech(audioBuffer, { minVolume: 0.2 });
 */
function processSpeech(audioData: AudioBuffer, options: ProcessingOptions): SpeechSegment[] {
  // Implementation
}
```

### API Documentation

- Document all API endpoints with request/response formats
- Include error codes and their meanings
- Provide usage examples

### Component Documentation

- Document component props and their types
- Include usage examples for complex components
- Document any side effects or context dependencies

## Testing Guidelines

### Unit Testing

- Write unit tests for all new functionality
- Aim for high test coverage, especially for critical paths
- Use meaningful test descriptions
- Follow the AAA pattern (Arrange, Act, Assert)

### Edge Function Testing

- Write tests for all Supabase Edge Functions
- Test files located in `supabase/functions/*/index.test.ts`
- Test entitlement and quota enforcement
- Mock Supabase client and external API calls

### Integration Testing

- Write integration tests for component interactions
- Test API endpoints with realistic scenarios
- Mock external dependencies appropriately
- Test RBAC entitlements and quota enforcement

### Running Tests

```bash
# Run all tests
pnpm test

# Run Supabase Edge Function tests
cd supabase/functions/<function-name>
deno test --allow-all

# Run tests with timeout (recommended for CI)
timeout 30 pnpm test
```

## Pull Request Process

1. **Create a pull request** from your feature branch to the `main` branch
2. **Fill out the pull request template** with:
   - Description of changes
   - Related issues
   - Testing performed
   - Screenshots (if applicable)
3. **Request reviews** from appropriate team members
4. **Address review feedback** and make necessary changes
5. **Ensure CI checks pass**
6. **Merge the pull request** once approved

## Release Process

Desktop app releases are automated via GitHub Actions:

1. **Version Bump**: Update `version` in `apps/app/package.json` (follow [Semantic Versioning](https://semver.org/))
2. **Release Notes**: Create release notes following the template in previous releases
3. **Tag and Push**:
   ```bash
   git tag v0.3.1
   git push origin v0.3.1
   ```
4. **Automated Build**: GitHub Action builds, signs (macOS), and publishes to [Knovy-Release](https://github.com/Intevia-AI/Knovy-Release)

### Deployment

- **Desktop App**: Automated via GitHub Actions on tag push
- **Edge Functions**: `supabase functions deploy`
- **Secrets**: `supabase secrets set --env-file ./supabase/.env.production`

## Project-Specific Guidelines

### Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Radix UI
- **Desktop**: Electron, Vite, whisper.cpp
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Edge Functions**: Deno, TypeScript

### Key Architecture Patterns

1. **RBAC System**: All AI actions protected by entitlements middleware
2. **Progressive Enhancement**: Raw transcription → Enhanced transcription with ID-based updates
3. **Dual-Stream Audio**: Separate microphone and system audio processing
4. **Local-First**: Desktop app uses local whisper.cpp for privacy

### Important Files

- `.claude/agents/`: Specialized AI agents for development tasks
- `docs/architecture/`: Architecture documentation
- `supabase/functions/_shared/`: Shared middleware and utilities
- `apps/app/src/main/`: Electron main process
- `apps/app/src/renderer/`: React renderer process

---

Thank you for contributing to Knovy! Your efforts help make this project better for everyone.
