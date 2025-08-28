# Contributing to Intevia AI

Thank you for your interest in contributing to Intevia AI! This document provides guidelines and workflows for contributing to the project.

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
   git clone https://github.com/your-org/intevia-ai.git
   cd intevia-ai
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   bash scripts/setup-env.sh
   ```

4. **Start the development servers**

   For the web application:

   ```bash
   # Terminal 1: Start the web application
   cd apps/web
   pnpm dev

   # Terminal 2: Start the proxy server
   cd apps/web
   pnpm proxy
   ```

   For the desktop application:

   ```bash
   cd apps/app
   pnpm dev
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

- Use functional components with hooks
- Keep components small and focused
- Use proper component composition
- Follow React best practices for performance optimization
- Use React context for state that needs to be shared across components

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

### Integration Testing

- Write integration tests for component interactions
- Test API endpoints with realistic scenarios
- Mock external dependencies appropriately

### End-to-End Testing

- Write end-to-end tests for critical user flows
- Test across different browsers and platforms when relevant

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch
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

1. **Version Bump**: Update version numbers according to [Semantic Versioning](https://semver.org/)
2. **Changelog**: Update the CHANGELOG.md file with notable changes
3. **Release Notes**: Create detailed release notes
4. **Tag**: Create a git tag for the release
5. **Build**: Generate production builds for all applications
6. **Deploy**: Deploy to production environments

---

Thank you for contributing to Intevia AI! Your efforts help make this project better for everyone.
