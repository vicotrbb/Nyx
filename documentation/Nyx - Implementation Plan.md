Based on the Product Requirements Document (PRD) and Technical Design, this implementation plan lays out a phased approach to build **Nyx** – an AI coding agent CLI tool in Node.js/TypeScript. We break down the work into cohesive modules (CLI interface, Orchestrator, Planner Agent, Task Graph, Worker Agents, Tools, Dashboard, Configuration, Documentation), with detailed steps a senior developer can follow. Throughout the implementation, we will adhere to modern Node.js/TypeScript best practices, maintain clear module boundaries (separation of concerns) for maintainability ([Separation of Concerns (SoC) | GeeksforGeeks](https://www.geeksforgeeks.org/separation-of-concerns-soc/#:~:text=Separation%20of%20Concerns%20,and%20scalability%20of%20software%20systems)), and use appropriate design patterns (e.g. Factory, Singleton) where beneficial. All code will include JSDoc comment blocks for documentation (instead of inline comments) to facilitate auto-generated docs and easy editor hints. Async/await will be used for asynchronous operations with proper error handling at each step. Below are the phases and tasks for implementing Nyx.

## Phase 1: Project Setup and Infrastructure

This phase establishes the project's foundational structure, build configuration, and coding standards. We set up the TypeScript project, configure build and lint tools, and define coding conventions to ensure consistency and quality from the start.

1. **Initialize Node.js Project**: Create a new Node.js project directory. Run `npm init -y` to generate a `package.json`. Set the package name to "nyx" (or appropriate) and ensure it has a `"bin"` field for the CLI (e.g. `"bin": { "nyx": "dist/cli/index.js" }`).
2. **Add TypeScript and Config**: Install TypeScript and necessary types: `npm install --save-dev typescript @types/node`. Create a `tsconfig.json` in the root with compiler options:
   - Target a modern ES version (ES2020 or later) compatible with Node 18/20.
   - Use `"module": "CommonJS"` or `"module": "ESNext"` depending on Node ESM support (if ESM, also add `"type": "module"` in package.json).
   - Set `"outDir": "dist"` for compiled output, `"rootDir": "src"` for sources.
   - Enable strict type checking (`"strict": true`) and useful compiler flags (`"esModuleInterop": true`, `"forceConsistentCasingInFileNames": true`, `"skipLibCheck": true`, etc.).
   - Ensure source maps are generated for easier debugging ( `"sourceMap": true` ). 
3. **Directory Structure**: Create a clear source directory layout under `src/`:
   - `src/cli/` – CLI entry point and command-line interface related code.
   - `src/core/` – Core logic (Orchestrator, Planner, TaskGraph, Agents).
   - `src/core/agents/` – Subdirectory for agent classes (PlannerAgent, WorkerAgent, etc.).
   - `src/core/tools/` – Subdirectory for tool modules (FileTool, ShellTool, OpenAI API integration).
   - `src/core/ui/` – (Optional) for UI/dashboard components if separated from CLI.
   - `src/core/memory/` – (Optional) for session memory management modules.
   - `src/config/` – Configuration management (load config, constants).
   - `src/docs/` – (Optional) if separating documentation generation or templates.
   - Ensure the directory names and structure reflect separation of concerns (each module handling one aspect of functionality ([Separation of Concerns (SoC) | GeeksforGeeks](https://www.geeksforgeeks.org/separation-of-concerns-soc/#:~:text=Separation%20of%20Concerns%20,and%20scalability%20of%20software%20systems))).
4. **ESLint and Prettier**: Install ESLint and Prettier for code style enforcement: `npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint-config-prettier`. Create an ESLint config (e.g. `.eslintrc.json`):
   - Extend from recommended configs: `"extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"]`.
   - Set parser to `@typescript-eslint/parser` and specify parserOptions for TS.
   - Include rules to enforce coding conventions, e.g. no unused vars, prefer `const`, etc. Also consider a rule or convention to avoid inline comments (focus on JSDoc for documentation).
   - Configure Prettier for formatting (and add an `.prettierrc` if needed). Ensure ESLint is aware of Prettier (using `eslint-config-prettier` to turn off conflicting rules).
   - Optionally set up lint scripts in package.json (e.g. `"lint": "eslint 'src/**/*.{ts,js}'"` and `"format": "prettier --write 'src/**/*.{ts,js,json,md}'"`).
5. **Build & Run Scripts**: In `package.json`, add scripts:
   - `"build": "tsc"`, to compile TypeScript to `dist/`.
   - `"start": "node dist/cli/index.js"`, to run the CLI (assuming compiled output).
   - `"dev": "tsc -w"`, for watch mode if needed during development.
   - `"lint": "eslint src --ext .ts"` and `"lint:fix": "eslint src --ext .ts --fix"` for code linting.
   - `"type-check": "tsc --noEmit"` to run type checks.
   - (If tests to be written, also add a test script, e.g. using Jest or Vitest.)
6. **Coding Conventions & Best Practices**: Establish rules to follow across all modules before implementation:
   - **Documentation**: Use **JSDoc** comment blocks for all public classes, methods, and complex functions to describe their purpose, parameters (`@param`) and return values (`@returns`). For example, a function should be prefaced with `/** ... */` describing what it does, rather than using inline `//` comments. This approach yields maintainable documentation and IDE tooltips ([Leveraging JSDoc for Better Code Documentation in JavaScript | PullRequest Blog](https://www.pullrequest.com/blog/leveraging-jsdoc-for-better-code-documentation-in-javascript/#:~:text=JSDoc%20is%20a%20documentation%20syntax,a%20specific%20field%20or%20method)).
   - **Modern TypeScript Practices**: Use `async/await` for asynchronous operations (file I/O, HTTP calls) to keep code readable, with `try/catch` for error handling. Leverage TypeScript's type system to avoid `any` where possible, preferring explicit types or generics for clarity and safety. Enable strict null checks and handle undefined cases defensively.
   - **Design Patterns**: Apply design patterns where appropriate:
     - Use a **Singleton** pattern for the Orchestrator if only one orchestrator should exist during runtime (the orchestrator could be a single global managing instance).
     - Use a **Factory** pattern for Tools or Agents if instantiation logic becomes complex or if selecting different implementations based on input (e.g., a ToolFactory to return the correct Tool instance for a given action) ([Factory Design Pattern in TypeScript - Bits and Pieces](https://blog.bitsrc.io/factory-design-pattern-in-typescript-55a91d74f3a4#:~:text=Factory%20Design%20Pattern%20in%20TypeScript,Step%203%3A%20Create%20the%20Factory)).
     - Possibly use the **Observer** pattern or event emitters for the Dashboard to listen to events from the core (so UI updates are decoupled from business logic).
     - Keep patterns lightweight and justified – avoid over-engineering.
   - **Separation of Concerns**: Each module should have a single, well-defined responsibility ([Separation of Concerns (SoC) | GeeksforGeeks](https://www.geeksforgeeks.org/separation-of-concerns-soc/#:~:text=Separation%20of%20Concerns%20,and%20scalability%20of%20software%20systems)). For instance, the PlannerAgent only handles breaking down high-level objectives into tasks (planning), the WorkerAgents only execute tasks, the Tools solely interface with external actions (file system, shell, API), and the Orchestrator coordinates these pieces. This modular approach ensures the system is easier to maintain and extend.
   - **Modular Organization**: Organize code into reusable modules within the single package. Cross-module interactions should use clear interfaces or contracts (TypeScript interfaces or abstract classes). For example, define interfaces for what a Tool or Agent can do, and have concrete classes implement them. This makes testing and potential future refactoring (or swapping implementations) easier.
   - **Error Handling**: All asynchronous calls (file writes, API calls, etc.) must be wrapped in try/catch, and errors should be propagated to the Orchestrator to decide whether to halt or continue. Define a consistent error-reporting mechanism (perhaps custom Error classes for specific error types like ToolError, AgentError) so that the Orchestrator or CLI can catch and display errors nicely.
   - **Asynchronous Safety**: When dealing with multiple tasks/agents in parallel, ensure use of synchronization primitives (like locks or queues) to avoid race conditions. We will implement a simple locking mechanism to guarantee mutual exclusion on shared resources ([Distributed Locks in Node.js](https://bpaulino.com/entries/distributed-lock-in-node-js#:~:text=A%20lock%20is%20a%20common,or%20write%20to%20shared%20data)) (discussed in a later phase). In a single-threaded Node context, this mainly concerns file writes or other shared outputs if tasks overlap.
   - **Code Style**: Follow a consistent coding style (which ESLint/Prettier will help enforce). Use descriptive naming for variables and functions (e.g. `generateTaskPlan()` instead of `plan()`), especially since this is an AI-driven project where clarity will aid future maintainers. Avoid overly long functions by refactoring into smaller helpers when needed.
   - **Git Practices**: (If relevant to the team workflow) commit small, logical units of work. We might also consider setting up Husky git hooks to run linting/tests on commit as a safety net (as seen in similar projects ([GitHub - openai/codex: Lightweight coding agent that runs in your terminal](https://github.com/openai/codex#:~:text=Git%20Hooks%20with%20Husky))), though this is optional.
7. **Version Control Setup**: Initialize a Git repository for the project if not already. Include a `.gitignore` for Node (ignoring `node_modules/`, `dist/`, `.env` files, etc.). This ensures secret keys and build artifacts are not committed.

By the end of Phase 1, we have a skeleton project with TypeScript compilation working, linting in place, an agreed directory structure, and clear conventions to guide the implementation that follows.

## Phase 2: CLI Interface Implementation

In this phase, we implement the command-line interface that serves as the entry point for Nyx. The CLI will parse user input (like objectives or commands) and initialize the orchestrator. It should also handle user options (flags for modes or configurations) and provide helpful usage info.

1. **Choose a CLI Library**: Add a library like **Commander** or **Yargs** for parsing CLI arguments (e.g., `npm install commander`). These libraries simplify defining commands and flags. For Nyx, the interface might be simple (a single command that takes the project goal as an argument), but using a library is beneficial for consistency and built-in help functionality. [DONE]
2. **Create CLI Entry Point**: In `src/cli/index.ts`, implement the main CLI logic. Add the Node shebang at the top of the compiled output (TypeScript: use `#!/usr/bin/env node` in a comment so it appears in output). Set up Commander (or chosen library) to define how the tool is invoked. [DONE]
3. **Handle Input Modes**: Implement logic so that if the user provides an objective as a command-line argument, Nyx will run in "one-shot" mode using that objective. If the user runs `nyx` with no arguments, the CLI can prompt for input (use Node's `readline-sync` or Commander's prompt feature). [DONE]
4. **Pass Control to Orchestrator**: Within the CLI action handler, instantiate or obtain the **Orchestrator** (using a stub initially) and call its main run method with the given objective and CLI options. Include basic error handling. [DONE]
5. **CLI Options and Configuration**: Ensure the CLI flags (like `--model` or `--no-dashboard`) defined using the CLI library are passed to the Orchestrator. Wiring to a full config system happens later. [DONE]
6. **Built-in Help and Usage**: Verify that running `nyx --help` displays helpful information automatically generated by the CLI library. [DONE]
7. **Testing the CLI**: Manually test the CLI basic functionality (parsing, help, input modes) during development. More comprehensive testing comes later. [DONE]

By the end of Phase 2, we have a functional CLI interface that can accept user input and call into a (stub) orchestrator. It sets the stage for hooking up the core logic in subsequent phases. The user can invoke Nyx from the terminal, see help, and pass configuration flags.

## Phase 3: Core Orchestrator Module

The **Orchestrator** is the central brain coordinating the Planner and Worker agents, managing tasks, and maintaining overall state. In this phase, we implement the Orchestrator class with methods to plan the project and execute tasks in order. This module will handle session memory, track progress, and ensure that multiple agents operate smoothly together (including managing any concurrency or locks as needed).

1. **Design Orchestrator Interface**: Create `src/core/orchestrator.ts` exporting an `Orchestrator` class (or singleton instance). This class will likely be used by the CLI. Key responsibilities include:
   - Receiving the project objective (the user prompt describing the desired application).
   - Invoking the PlannerAgent to break the objective into a plan (a set of tasks).
   - Coordinating multiple WorkerAgent instances to execute each task in sequence or parallel as appropriate (multi-agent orchestration).
   - Tracking session state: which tasks are completed, partial results (like files created), and any shared context or memory that needs to persist across tasks.
   - Interfacing with the UI (Dashboard) by emitting events or callbacks for important updates (task start, task finish, etc.).
   - Ensuring safe operation by coordinating locks on resources and handling failures.
2. **Singleton Pattern** (optional): If only one Orchestrator should exist (which makes sense per run/session), implement `Orchestrator` as a singleton:

   ```ts
   export class Orchestrator {
       private static instance: Orchestrator;
       private constructor() { /* ... initialize properties ... */ }
       static getInstance(): Orchestrator {
           if (!Orchestrator.instance) {
               Orchestrator.instance = new Orchestrator();
           }
           return Orchestrator.instance;
       }
       // ... other methods ...
   }
   ```

   This ensures any part of the code referencing the Orchestrator gets the same instance (with the same task state, config, etc.). Alternatively, manage a single instance in the CLI and pass it around as needed.
3. **Orchestrator State Properties**: Inside the class, define member properties to manage state:
   - `objective: string` – the overall goal or project description.
   - `tasks: TaskGraph` – the planned tasks (we will define TaskGraph in the next phase). This could be a custom structure or simply an array of task objects initially.
   - `memory: SessionMemory` – a structure to hold session context (e.g., conversation logs or key information to reuse in prompts). This could start simple (like an array of messages or a summary string).
   - `config: NyxConfig` – if there's a config object (from Phase 7) with settings (model, API keys, etc.).
   - Possibly `lockManager: LockManager` – to handle resource locks for parallel tasks (to be implemented in Phase 5 or 6).
   - `ui: DashboardUI` – reference to the Dashboard interface, if any, so Orchestrator can send it updates.
   - Other flags or counters (like current task index, etc.).
4. **Plan-and-Execute Flow**: Implement the main method, e.g., `async run(objective: string, options: CLIOptions)`. This will be called by the CLI:
   - Save the `objective` into the orchestrator state and perhaps also into a first memory entry (for reference).
   - If the user only wanted to see a plan (`options.planOnly`), call the PlannerAgent to get tasks, then output them and return (skip execution).
   - Otherwise, proceed with full execution:
     1. Call `this.planTasks()` to generate the task plan (use PlannerAgent, handled in Phase 4). This should populate `this.tasks` (the TaskGraph).
        - After planning, if the UI is enabled, send the list of planned tasks to be displayed (or log them to console).
     2. Call `this.executeTasks()` to carry out the tasks. This could either run tasks sequentially or in parallel where safe. We will implement this function to iterate through the TaskGraph and dispatch tasks to WorkerAgents (Phase 5).
     3. Once all tasks are completed, finish the run. Possibly print a summary or final message (like "Project generation complete. See the output in ...").
   - Surround the above steps in a try/catch:
     - On error, log an error message (and possibly abort further tasks).
     - Perhaps allow the orchestrator to attempt some recovery (for example, if a single task fails, it might continue with others or re-plan, but initial implementation can just stop).
   - Respect any relevant CLI flags in behavior (for instance, if `--auto-confirm` is false and we had an interactive confirm step for something, integrate that logic here; otherwise full-auto).
5. **Task Execution Logic**: In `executeTasks()`, implement how tasks are taken from the plan and executed:
   - If using a simple sequential approach initially: loop through the task list (or fetch next available from TaskGraph if dependencies exist) and for each:
     - Log/emit that the task is starting (for UI or console).
     - Create or assign a **WorkerAgent** to that task. Likely instantiate a new WorkerAgent for each task for simplicity (the WorkerAgent will encapsulate the logic to perform that task using appropriate tools).
     - Call an async method like `await worker.execute(task)`, which returns a result or status.
     - Mark the task as completed (and store any result if needed, e.g. if the task output is needed for memory or for other tasks).
     - If the WorkerAgent indicates that new tasks were generated or existing tasks updated (some agent frameworks might adjust the plan on the fly), update the TaskGraph accordingly. For example, if executing a task reveals the need for an additional step, the Orchestrator could insert a new task. (This is an advanced feature; initially, we can assume the plan is static, but we design the TaskGraph to allow adding tasks in case we implement BabyAGI-like dynamic planning later ([Exploring Popular AI Agent Frameworks: Auto-GPT, BabyAGI, LangChain Agents, and Beyond - Kuverto | AI Agent Builder Platform](https://kuverto.com/blog/exploring-popular-ai-agent-frameworks-auto-gpt-babyagi-langchain-agents-and-beyond/#:~:text=1,building%20their%20own%20AI%20agents)).)
     - Continue until all tasks are done.
   - If planning to support **parallel execution** for independent tasks: 
     - Determine if tasks can run in parallel by checking dependencies or resource conflicts. For example, tasks with no dependencies between each other could be launched simultaneously.
     - Implement a mechanism to dispatch multiple WorkerAgents and use `Promise.all` or similar to run them concurrently.
     - Use the LockManager to avoid conflicts (e.g., if two tasks might write to the same file, the LockManager should queue one behind the other).
     - This is complex; initial version can stick to sequential execution, but structure the code to allow parallelism later (e.g., process tasks from TaskGraph in a loop that always checks for any available tasks).
   - Handle task failures: If a WorkerAgent throws an exception or returns a failure status for a task:
     - Log the failure (and show on UI).
     - Decide whether to abort the entire run or continue with remaining tasks. Possibly stop if a critical task failed (especially if other tasks depend on it).
     - For resilience, we might catch errors per task and allow continuing with unrelated tasks, but ensure overall outcome is clearly communicated.
6. **Session Memory Handling**: As tasks are executed, maintain a memory of the session in `this.memory`:
   - After planning, memory might include the breakdown of tasks.
   - After each task, record what was done – e.g., a summary like "Task 1: Created project scaffolding (files X, Y)".
   - This memory can be used to inform subsequent tasks. For instance, when WorkerAgent handles Task 2, the Orchestrator can pass a summary of Task 1's result to it (so the LLM knows the context).
   - Implement helper methods like `updateMemoryAfterTask(task: Task, result: TaskResult)` that appends to a memory log or updates a state that can be serialized.
   - If the PRD expects the agent to recall the conversation or have long-term memory, consider using a more advanced memory: e.g., storing important data in a JSON or even a vector store for semantic recall. For now, a simple in-memory log or a JSON file persisted at `./nyx_session.json` could suffice for session memory.
   - The memory can also be leveraged if the Orchestrator needs to re-plan. For example, if new tasks are added, the PlannerAgent could be invoked with context of what's done so far (like BabyAGI's approach of iterative planning ([Exploring Popular AI Agent Frameworks: Auto-GPT, BabyAGI, LangChain Agents, and Beyond - Kuverto | AI Agent Builder Platform](https://kuverto.com/blog/exploring-popular-ai-agent-frameworks-auto-gpt-babyagi-langchain-agents-and-beyond/#:~:text=1,building%20their%20own%20AI%20agents))).
7. **Logging and Events**: Add logging throughout Orchestrator methods:
   - Use a dedicated logger or just console output (which later can be redirected to the UI). For each major event (planning completed, task started, task finished, errors), output a message. This will aid debugging and also feeds the observability dashboard.
   - Define events or callbacks if using an event-driven approach. For example, Orchestrator could extend Node's `EventEmitter` class and emit events like `'taskStarted'`, `'taskCompleted'`, `'allTasksDone'` with relevant data. The Dashboard UI (Phase 6) or CLI could listen to these events to update the display.
   - Ensure these logs/events include enough info (task name or summary, timestamps if needed) but avoid overly verbose logs that might flood the UI. Striking a balance is key for observability.
8. **Integrate Orchestrator with CLI Options**: Revisit how the CLI passes options:
   - For `--no-dashboard`: If true, Orchestrator should know not to initialize the Dashboard UI. Perhaps pass a flag to `run()` that results in only console logging.
   - For any other options like `--model`, ensure the Orchestrator (or the config it uses) is updated with those values before planning starts (e.g., set the OpenAI model in config).
   - If an interactive mode is envisioned (not explicitly in PRD, but if we had step-by-step confirmation), orchestrator would check option and maybe prompt user (via CLI input) before executing each task or certain risky actions. Since the question doesn't detail that, we assume full autonomy by default.
9. **Test Orchestrator in Isolation**: Add TODOs for tests. [DONE]

By the end of Phase 3, we have the orchestrator core structure ready. It knows how to take an objective, produce a plan (though using a placeholder for now), iterate through tasks, and manage state. This sets up the scaffolding to plug in the actual AI planning and working logic next.

## Phase 4: Planner Agent and Task Graph

In this phase, we build the **PlannerAgent** that uses the OpenAI API to break down the user's objective into discrete tasks. We also implement the **TaskGraph** data structure to hold these tasks (and their dependencies or relationships). The PlannerAgent plus TaskGraph fulfills the "task planning" feature, enabling multi-step plans for complex objectives ([Exploring Popular AI Agent Frameworks: Auto-GPT, BabyAGI, LangChain Agents, and Beyond - Kuverto | AI Agent Builder Platform](https://kuverto.com/blog/exploring-popular-ai-agent-frameworks-auto-gpt-babyagi-langchain-agents-and-beyond/#:~:text=%2A%20Task%20Decomposition%3A%20Auto,or%20interact%20with%20other%20applications)).

1. **Define Task Structure**: Create a `Task` interface or class in `src/core/agents/task.ts` (or a relevant file) to represent a unit of work. [DONE]
2. **Implement TaskGraph**: In `src/core/taskGraph.ts`, implement a `TaskGraph` class or simply a collection to manage tasks. [DONE]
3. **PlannerAgent Class**: Create `src/core/agents/plannerAgent.ts` with an exported `PlannerAgent` class responsible for generating the task list from an objective. [DONE]
4. **OpenAI API Integration**: Setup an **OpenAI tool/service** that the PlannerAgent (and later WorkerAgents) will use. [DONE]
5. **Testing PlannerAgent**: Add TODOs for tests. [DONE]
6. **Integration with Orchestrator**: Connect the PlannerAgent to the Orchestrator from Phase 3. [DONE]
7. **Edge Cases**: Add TODOs for improving edge case handling in parsing. [DONE]

## Phase 5: Worker Agents and Tool Implementation

This phase focuses on the **WorkerAgents** – the agents that execute each planned task – and the suite of **Tools** they use to interact with the environment (file system, shell, etc.). Each WorkerAgent will take a task from the TaskGraph and perform it, likely using the OpenAI API for tasks that require code generation or reasoning, and using the Tools for actions like writing files or running commands. We will also implement concurrency control (locks) to ensure parallel tasks don't conflict.

1. **WorkerAgent Base Class**: Create `src/core/agents/workerAgent.ts` and define a `WorkerAgent` class and `TaskResult` interface. [DONE]
2. **FileTool (File Manager)**: Implement a utility for file operations at `src/core/tools/fileTool.ts`. [DONE]
3. **ShellTool (Shell/Process Runner)**: Implement `src/core/tools/shellTool.ts`. [DONE]
4. **OpenAI Tool usage in WorkerAgent**: Implement logic within `WorkerAgent.execute` to use LLM and tools based on task description. [DONE - Refined with context gathering & parsing]
5. **Parallel Execution and Locking**: Implement the `LockManager` utility and integrate locking into `WorkerAgent`. [DONE]
6. **Return of Task Results**: Finalize the `TaskResult` structure and ensure `WorkerAgent.execute` returns it consistently. [DONE]
7. **Testing WorkerAgent with Tools**: Add TODOs for tests. [DONE]
8. **Integrate WorkerAgent with Orchestrator**: Modify `Orchestrator.executeTasks` to use the implemented `WorkerAgent`. [DONE]
9. **Ensure Tools Reusability**: Review tool design for reusability and testability. [DONE]
10. **Continuous Code Documentation**: Add JSDoc comments for Phase 5 components. [SKIPPED]

## Phase 6: Dashboard (Observability UI)

In this phase, we implement the **Dashboard** – a split-panel terminal interface for observing Nyx's behavior in real-time. This interactive UI will allow the user to see the list of tasks and the ongoing details of each step, making the agent's process transparent. We will use a terminal UI library to create this experience.

1. **Choose TUI Library**: Use a Node.js terminal UI library like **blessed** and **blessed-contrib**. Install dependencies. [DONE]
2. **Design UI Layout**: Decide on the split-panel layout (e.g., Tasks/Status on left, Details/Log on right). [DONE]
3. **Implement Dashboard Module**: Create `src/core/ui/dashboard.ts` with a `Dashboard` class that initializes the blessed screen and basic panel structure. [DONE]
4. **Connecting Orchestrator Events to UI**: Modify `Orchestrator` to initialize the `Dashboard` and connect its events (planReady, log, taskStatusUpdate) to dashboard update methods. [DONE]
5. **Conditional UI Usage**: Implement logic to enable/disable the dashboard based on the `--no-dashboard` CLI flag. [DONE]
6. **Refresh and User Experience**: Ensure `screen.render()` is called on updates and basic exit keys work. [DONE]
7. **Testing the Dashboard**: Add TODOs for tests (manual testing needed for visuals). [DONE]
8. **Documentation of UI**: Add notes to README about the dashboard (Phase 8). [PENDING]

After Phase 6, users of Nyx will have a rich view into the agent's operation: one panel listing tasks and their completion status, and another showing the ongoing log/details of what Nyx is doing. This addresses the observability requirement with a TUI that runs in the same terminal ([GitHub - chjj/blessed: A high-level terminal interface library for node.js.](https://github.com/chjj/blessed#:~:text=blessed)). Developers can watch the agent's reasoning and actions live, increasing trust and debuggability.

## Phase 7: Configuration and Environment Management

In this phase, we ensure that Nyx's configuration (like API keys, model selection, and other settings) is handled in a robust and user-friendly way. We integrate environment variable loading, default configurations, and possibly a config file, so that users and developers can easily adjust parameters without modifying code.

1. **Environment Variables Setup**: Ensure `dotenv/config` is imported early in `cli/index.ts` to load `.env` files. [DONE]
2. **Global Config Object**: Implement `NyxConfig` interface and `loadConfig` function in `src/config/nyxConfig.ts` to merge defaults, environment variables (API key, model), and CLI options. [DONE]
3. **Integrate Config in Modules**: Update `CLI`, `Orchestrator`, `PlannerAgent`, `WorkerAgent`, `openaiTool`, `fileTool`, and `shellTool` to use the loaded `NyxConfig` object. [DONE]
4. **Distributed or Team Settings**: Document how users should manage their own API keys (e.g., via `.env`). [PENDING - Documentation Phase 8]
5. **Quality Assurance**: Add checks in `loadConfig` for required settings (API key) and handle missing values gracefully. [DONE]
6. **Flexibility for Future**: Keep config structure extensible. [DONE - Structure allows adding new fields]
7. **Testing Config**: Add TODOs for tests. [DONE]

After Phase 7, Nyx will have a solid configuration system: the user can configure through environment or CLI flags, and the application code uses a centralized config object, making it easy to adjust and ensuring sensitive info like API keys are handled properly ([GitHub - openai/codex: Lightweight coding agent that runs in your terminal](https://github.com/openai/codex#:~:text=,dotenv%2Fconfig)). This makes Nyx more flexible and secure.

## Phase 8: Documentation and Finalization

Finally, we create comprehensive documentation and perform final checks. Documentation is crucial for both users and future contributors to understand how to use Nyx and how it is designed.

1. **README.md**: Create a top-level `README.md` with the following content:
   - **Project Title and Description**: A brief introduction: e.g., "# Nyx – AI Coding Agent CLI" and a one-paragraph description of what it does (transform natural language project specs into fully working code using AI, etc).
   - **Features**: Bullet list of Nyx's capabilities, highlighting multi-agent orchestration, automated task planning, file and shell tool usage, and the interactive dashboard.
   - **Installation**: Instructions on how to install or run Nyx. If published on npm, e.g. "`npm install -g nyx-cli`" then use as `nyx`. If running from source: "`git clone ... && npm install && npm run build`".
   - **Setup**: Explain how to set the OpenAI API key. For example: "Set your API key in the OPENAI_API_KEY environment variable or in a .env file before running Nyx ([GitHub - openai/codex: Lightweight coding agent that runs in your terminal](https://github.com/openai/codex#:~:text=,dotenv%2Fconfig))." Provide an example .env line. Also mention any other environment like model choice if applicable.
   - **Usage**: Show examples of running Nyx:
     - Basic example: ````shell
       $ nyx "Create a simple TODO web app with Node.js and Express"

       ````
       and then describe (in prose) what Nyx will do (e.g., "Nyx will generate a plan of tasks and start executing them, creating files... etc.").
     - Explain the CLI options: e.g., `--no-dashboard` (if someone has a problem with the interactive UI or is running in a non-TTY environment, they can disable it), `--plan-only` (to just see the plan), `--model` (to choose model), etc. Possibly include the output of `nyx --help` as a reference in the README.

     - If the Dashboard is a key feature, you might include a screenshot of it in action (though in Markdown plain text, a screenshot image could be added if available; but per instructions we won't add an image unless already obtained. Alternatively, use a small ASCII demo).
   - **How it Works**: Provide a summary of the architecture:
     - Describe that Nyx uses a Planner Agent (powered by an LLM) to break down tasks ([Exploring Popular AI Agent Frameworks: Auto-GPT, BabyAGI, LangChain Agents, and Beyond - Kuverto | AI Agent Builder Platform](https://kuverto.com/blog/exploring-popular-ai-agent-frameworks-auto-gpt-babyagi-langchain-agents-and-beyond/#:~:text=%2A%20Task%20Decomposition%3A%20Auto,or%20interact%20with%20other%20applications)), then uses Worker Agents to implement each task, with file operations and command execution integrated.
     - Mention that it uses multi-step reasoning similar to Auto-GPT/BabyAGI concepts (for those familiar) ([Exploring Popular AI Agent Frameworks: Auto-GPT, BabyAGI, LangChain Agents, and Beyond - Kuverto | AI Agent Builder Platform](https://kuverto.com/blog/exploring-popular-ai-agent-frameworks-auto-gpt-babyagi-langchain-agents-and-beyond/#:~:text=%2A%20Task%20Decomposition%3A%20Auto,or%20interact%20with%20other%20applications)).
     - Highlight the safety measures: runs locally, requires user's API key, has a confirm mode (if implemented or planned), and locks to avoid messing up files concurrently.
     - Mention the observability UI and how it helps follow the process.
   - **Configuration**: Document environment variables and config:
     - OPENAI_API_KEY (required), OPENAI_MODEL (optional, default GPT-4).
     - If there's a config file option or any default paths (like workspaceDir if used).
     - If relevant, note that internet access or other capabilities depend on OpenAI plugins (if we were to extend).
   - **Limitations**: Be honest about current limitations:
     - For example, "This is an experimental tool; the quality of generated code depends on the LLM. It may not always produce a perfect result and might require user review." 
     - "Parallel execution is limited by simple locking; heavy parallel tasks could cause race conditions if not properly understood by the AI (we mitigate with locks but results may vary)."
     - "Memory is session-limited; it doesn't store knowledge between separate runs (unless you reuse the same directory which contains the files created)."
     - etc.
   - **Future Improvements**: Short section, if desired, listing ideas like plugin system, support for other models, more interactive feedback loop for debugging, etc.
   - **Contributing**: If open-source, instructions for contributing: how to run tests, code style (mention ESLint/Prettier), and that they should use JSDoc for any new code, etc. We can reference our coding conventions so new contributors know to maintain them (e.g., "Please document new functions with JSDoc and keep functions focused as per our design guidelines."). If there's a CLA or anything (like openai/codex had), mention if applicable.
   - **License**: If relevant, state the license of the project (e.g., MIT). 
   - Ensure the README is well-formatted and uses Markdown features (like code blocks, headings, links if needed). This is the first thing users see, so clarity is key.
2. **Usage Example and Testing**: Along with documentation, create a `examples/` directory or just include a simple scenario in README that was tested:
   - For instance, test Nyx on a small project idea (like the TODO app or a calculator CLI app) and walk through the outcome in the README (maybe as a narrative or partial log output).
   - Show the task plan it came up with and maybe list the files it generated. This gives users an idea of what to expect.
   - (Be careful not to include huge logs, just a summarized version or a selective snippet of the output.)
3. **API Documentation (Optional)**: If Nyx is intended to be used as a library as well (e.g., someone might require it in a Node script and call an API), consider generating documentation for the classes:
   - Using JSDoc comments we wrote, we can generate HTML or markdown docs. We can add a script `"docs": "jsdoc -c jsdoc.json"` to produce docs if needed.
   - If it's not intended as a library, this might not be necessary. However, the internal architecture documentation could be beneficial for contributors. Perhaps include an `ARCHITECTURE.md` or use the wiki for more detailed technical explanation (much of which is in this plan).
   - At least, ensure that the JSDoc we added is correct so developers reading the code find it understandable.
4. **Final Code Review and Refactoring**: Before final release, do a pass through the code for cleanup:
   - Remove any leftover `console.log` that was for debugging (except those that are meant to be user messages).
   - Ensure error messages are clear and not overly technical when shown to end user.
   - Check for any TODO comments or unhandled promises.
   - Run `npm run lint` and fix any warnings. Run `npm run build` to ensure no TypeScript errors.
   - If tests were added, run them.
   - Try running `nyx` on a real small prompt and see end-to-end performance.
   - Possibly test on both Windows and Unix if shell commands or paths might behave differently (FileTool path separators, etc. using Node path library to be safe).
5. **One-shot Full Application Test**: As the last verification, attempt a "one-shot full application development" run:
   - For example, "nyx \"Build a simple Node.js Express API with one endpoint that returns 'Hello World'\"" and observe. This should ideally:
     - Plan tasks (initialize project, write server code, maybe write package.json, run it).
     - Execute tasks (create package.json, create index.js or server.ts, maybe run `node index.js` to test).
     - You as the tester verify the output files and run the server to see if it works.
     - This scenario will prove if Nyx can indeed go from prompt to working code autonomously in one run.
   - Document in README or as a comment the success or any manual tweak needed (if it fails, note the limitation).
6. **Release Prep**: If distributing, update version in package.json, and ensure the bin file has correct permissions (`chmod +x dist/cli/index.js` if packaging).
   - If using npm publish, ensure not to include unnecessary files (maybe use `.npmignore` if needed, though by default it ignores dev stuff).
   - Tag a release in version control if needed.
7. **Continuous Maintenance**: Note that going forward, any new feature should follow the established patterns:
   - E.g., if adding a new Tool, keep it isolated in tools folder and document it.
   - If modifying planning logic, ensure to update any related tests/docs.
   - The coding conventions set should be followed for consistency.

With Phase 8 completed, Nyx is thoroughly documented and ready for use and/or release. The development team and end users have clear guidance on how to use the tool and how the implementation is structured. The comprehensive documentation and structured code will make future contributions or troubleshooting much easier. 

----

**References:**

- OpenAI Codex CLI example, illustrating environment variable config and usage ([GitHub - openai/codex: Lightweight coding agent that runs in your terminal](https://github.com/openai/codex#:~:text=,dotenv%2Fconfig)).  
- Autonomous agent frameworks (Auto-GPT, BabyAGI) emphasize task decomposition, memory management, and tool use ([Exploring Popular AI Agent Frameworks: Auto-GPT, BabyAGI, LangChain Agents, and Beyond - Kuverto | AI Agent Builder Platform](https://kuverto.com/blog/exploring-popular-ai-agent-frameworks-auto-gpt-babyagi-langchain-agents-and-beyond/#:~:text=%2A%20Task%20Decomposition%3A%20Auto,or%20interact%20with%20other%20applications)), principles we applied in Nyx's design.  
- Separation of Concerns principle, used to structure Nyx into distinct modules ([Separation of Concerns (SoC) | GeeksforGeeks](https://www.geeksforgeeks.org/separation-of-concerns-soc/#:~:text=Separation%20of%20Concerns%20,and%20scalability%20of%20software%20systems)).  
- JSDoc best practices for code documentation, to ensure maintainability and editor support ([Leveraging JSDoc for Better Code Documentation in JavaScript
| PullRequest Blog](https://www.pullrequest.com/blog/leveraging-jsdoc-for-better-code-documentation-in-javascript/#:~:text=JSDoc%20is%20a%20documentation%20syntax,a%20specific%20field%20or%20method)).  
- Blessed terminal library for building a split-panel text UI in Node (used for Nyx Dashboard) ([GitHub - chjj/blessed: A high-level terminal interface library for node.js.](https://github.com/chjj/blessed#:~:text=blessed)).  
- Locking mechanism concept, to enforce mutual exclusion when accessing resources in parallel execution ([Distributed Locks in Node.js](https://bpaulino.com/entries/distributed-lock-in-node-js#:~:text=A%20lock%20is%20a%20common,or%20write%20to%20shared%20data)).
