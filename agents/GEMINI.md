# GEMINI.md

This file provides guidance to the Gemini CLI when working with code in this repository.

## Project Overview

This is the Awesome Agents repository - a collection of specialized AI agents that extend Gemini's capabilities through intelligent orchestration and domain expertise. The agents work together as a development team, with each agent having specific expertise and delegation patterns.

## Working with Agents

When creating or modifying agents:

1. Agents are Markdown files with YAML frontmatter
2. Most agents should omit the `tools` field to inherit all available tools
3. Use XML-style examples in descriptions for intelligent invocation
4. Agents return structured findings for main agent coordination

## Orchestration Pattern for Gemini CLI

Since agents in Gemini CLI cannot directly invoke other sub-agents, orchestration follows this strict pattern:

### CRITICAL: Agent Routing Protocol

**When handling complex tasks, you MUST:**

1. **ALWAYS start with a planning agent** for any multi-step task to create a plan.
2. **FOLLOW the agent routing map** defined in the plan EXACTLY.
3. **USE ONLY the agents** explicitly recommended for the task.
4. **NEVER select agents independently** - the plan dictates which agents exist and are approved for the task.

### Example: Building a Feature with Agent Routing

```
User: "Build a user management system"

Main Gemini Agent:
1. First, I'll analyze the request and the project plan to get routing.
   → The plan provides an Agent Routing Map with SPECIFIC agents for each task.

2. I MUST use ONLY the agents listed in the routing map:
   - If the plan says "use backend-developer" → Use that EXACT agent
   - If the plan says "use react-component-architect" → Use that EXACT agent
   - DO NOT substitute with generic agents unless specified as fallback

3. Execute tasks in the order specified by the plan.
```

### Key Orchestration Rules

1. **The Plan is the Routing Authority**: The project plan (`agents/plan.md`) determines which agents can handle each task.
2. **Strict Agent Selection**: Use ONLY agents from the project's `agents/` directory.
3. **No Improvisation**: Do NOT select agents based on your own judgment if a plan exists.
4. **Deep Reasoning**: Apply careful thought when coordinating the recommended agents.
5. **Structured Handoffs**: Extract and pass information between agent invocations.

### Agent Selection Flow

```
CORRECT FLOW:
User Request → Project Plan Analysis → Agent Routing Map → Execute with Listed Agents

INCORRECT FLOW:
User Request → Main Agent Guesses → Wrong Agent Selected → Task Fails
```

### Example Agent Roster You Must Follow

When the project contains these agents:

```
## Available Agents for This Project
- backend-developer: General backend tasks
- frontend-developer: General frontend tasks
- react-component-architect: React UI components
- tailwind-css-expert: Tailwind CSS styling
- api-architect: API design
```

You MUST use these specific agents for their designated tasks.

## PROJECT-SPECIFIC GUIDELINES

- **Tech Stack**:
  - **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
  - **Backend**: Supabase (PostgreSQL, Auth, Functions)
  - **Extension**: Chrome Extension with TypeScript and React.
- **Development Workflow**:
  1.  Consult `agents/plan.md` for the current project phase and tasks.
  2.  Select the appropriate agent for the task as specified in the plan.
  3.  Follow a Test-Driven Development (TDD) approach where possible. Write tests before implementation.
  4.  For UI components, use `react-component-architect` and adhere to `shadcn/ui` principles if applicable.
  5.  For backend logic, especially Supabase functions, use `backend-developer`.
  6.  All styling changes must be implemented using `tailwind-css-expert`.
- **Testing**:
  - **Unit/Integration Tests**: Jest and React Testing Library.
  - **E2E Tests**: Playwright.
  - Run tests before committing changes.
  - Remember to force stop the in-progress testing after 30 seconds test by adding `timeout 30` before the test command.

## High-Level Architecture

The project follows a hierarchical structure as defined in `agents/plan.md`. Refer to the architecture diagrams there for a visual overview. The main components are the website, the Chrome extension, and the Supabase backend.

## Important Files and Patterns

- `agents/plan.md`: Detailed project roadmap and task breakdown.
- `agents/core/code-archaeologist.md`: Guide for creating code archaeology.
- `agents/core/code-reviewer.md`: Guide for reviewing code.
- `agents/core/documentation-specialist.md`: Guide for creating documentation.
- `agents/core/performance-optimizer.md`: Guide for creating performance optimizations.
- `agents/orchestrators/project-analyst.md`: Guide for analyzing the project.
- `agents/orchestrators/team-configurator.md`: Guide for configuring the team.
- `agents/orchestrators/tech-lead-orchestrator.md`: Guide for orchestrating the team.
- `agents/specialized/react-component-architect.md`: Guide for creating React components.
- `agents/universal/api-architect.md`: Guide for creating API endpoints.
- `agents/universal/backend-developer.md`: Guide for creating backend code.
- `agents/universal/frontend-developer.md`: Guide for creating frontend code.
- `agents/universal/tailwind-css-expert.md`: Guide for creating Tailwind CSS components.
- All agents support human-in-the-loop for approval of significant changes.
