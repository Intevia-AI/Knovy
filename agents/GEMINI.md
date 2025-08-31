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
5. **DO NOT edit the diff between '' and ""** - just use the one that follows the linting rules.

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

1. **The Plan is the Routing Authority**: At the start of a task, ask the user to provide the path to the **active plan file** (e.g., `plans/backend-refactor.md`). This file determines which agents can handle each task.
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
- **Development Workflow**:
  1.  Consult the **active plan file** (provided by the user, e.g., from the `plans/` directory) for the current project phase and tasks.
  2.  Select the appropriate agent for the task as specified in the plan.
  3.  Follow a Test-Driven Development (TDD) approach where possible. Write tests before implementation.
  4.  For UI components, use `react-component-architect` and adhere to `shadcn/ui` principles if applicable.
  5.  For backend logic, especially Supabase functions, use `backend-developer`.
  6.  All styling changes must be implemented using `tailwind-css-expert`.
- **Code Interpretation**:
  - Do not blindly trust comments in the code. Comments can become outdated.
  - The code itself is the most reliable source of truth. Prioritize understanding the code's logic and structure over comments when they are in conflict.
- **Testing**:
  - **Unit/Integration Tests**: Jest and React Testing Library.
  - **E2E Tests**: Playwright.
  - Run tests before committing changes.
  - Remember to force stop the in-progress testing after 30 seconds test by adding `timeout 30` before the test command.
  - Do not update the code just to pass the tests.

## Agent Logging Workflow

To ensure transparency and effective collaboration, all agents MUST follow this logging workflow for every assigned task.

### 1. Task Creation

Before beginning work on a task, you must create a task log.

1.  **Create a new file** in the `@agent_logs/tasks/` directory.
2.  **Name the file** using a numeric prefix and a short description (e.g., `0001-TASK-secure-proxy-setup.md`).
3.  **Use the template**: Copy the content from `@agent_logs/task-template.md` into your new file.
4.  **Fill out the template**: Complete the `Goal`, `Context`, and `Plan` sections.

### 2. Result Reporting

After you have successfully completed a task, you must create a result log.

1.  **Create a new file** in the `@agent_logs/results/` directory.
2.  **Name the file** using the same numeric prefix and a `RESULT` keyword (e.g., `0001-RESULT-secure-proxy-setup.md`).
3.  **Document the results**: In this file, provide a clear summary of:
    - **What was accomplished**: A brief description of the completed work.
    - **Files Modified**: A list of all files that were created, modified, or deleted.
    - **Issues Encountered**: A description of any problems you faced during the task.

### 3. Troubleshooting Log

If you encounter a significant, non-obvious issue that requires a specific workaround or solution, you must document it to help other agents, and vice versa you can also use the troubleshooting log to help yourself.

1.  **Open** the `@agent_logs/troubleshooting.md` file.
2.  **Add a new entry**: Copy the template from the top of the file.
3.  **Fill out the entry**: Detail the `Issue`, the `Context` in which it occurred, and the `Solution` or `Workaround` you discovered.
4.  **NOTE**: Add the ticket/task number that you were working on in the `Issue` section, so other agents can find the relevant log.

## High-Level Architecture

The project follows a hierarchical structure as defined in the **active plan file**. Refer to the architecture diagrams there for a visual overview.

## Important Files and Patterns

- `plans/`: Directory containing all project and development plans.
- `agent_logs/`: Directory for all agent task, result, and troubleshooting logs.
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
