# Nyx – AI Coding Agent CLI

Nyx is an autonomous AI coding agent CLI designed to plan, write, execute, and validate code with minimal human intervention. It leverages advanced AI (LLM-based) reasoning to turn natural language requests into working software, aiming to accelerate development by handling the full lifecycle from requirements to verification.

## Features

* **Autonomous Operation:** Executes development tasks from a single high-level objective (`one-shot mode`).
* **AI-Powered Planning:** Breaks down complex goals into structured task plans with dependencies.
* **Code Generation & Execution:** Writes code using LLMs, modifies files, and runs necessary build/test commands.
* **Application Interaction & Validation:** (Core Feature - In Development) Aims to launch and interact with the generated application (e.g., via headless browser for web apps) to test functionality and catch runtime errors.
* **Automated Audits:** (Future Goal) Intends to integrate performance/SEO audits (e.g., Lighthouse).
* **Concurrency Safety:** Includes a file locking mechanism (`.nyx-locks/`) to prevent conflicts during file writes.
* **Interactive Dashboard:** Provides a real-time terminal UI (TUI) showing the plan, logs, agent status, and statistics.

## Installation

Currently, Nyx is run from source.

1. **Clone the repository:**

    ```bash
    git clone <repository_url> # Replace with actual URL
    cd nyx
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Build the project:**

    ```bash
    npm run build
    ```

Alternatively, you can link the package globally for development:

```bash
npm link
# Now you can use the 'nyx' command directly
```

## Setup

Nyx requires an OpenAI API key to function.

1. **Set API Key:** Create a `.env` file in the project root directory (`nyx/`) with the following content:

    ```dotenv
    OPENAI_API_KEY=your_openai_api_key_here
    ```

    Replace `your_openai_api_key_here` with your actual OpenAI API key.
    Alternatively, you can set the `OPENAI_API_KEY` environment variable directly.

2. **(Optional) Select Model:** You can specify the OpenAI model to use via the `--model` flag (see Usage) or by setting the `OPENAI_MODEL` environment variable (e.g., `OPENAI_MODEL=gpt-3.5-turbo`). If not set, it defaults to `gpt-4`.

## Usage

Run Nyx from your terminal within your project directory (or the Nyx directory itself if testing). Nyx operates through its interactive dashboard by default.

```bash
# Build the project first if you haven't already
npm run build

# Run Nyx (using node)
node dist/cli/index.js

# Or, if you linked the package:
nyx
```

Upon starting, Nyx will display its dashboard UI:

* The **left panel** shows the task list (initially waiting for input).
* The **right panel** shows logs, agent status, and statistics.
* The **bottom panel** is the input box.

**Instructions:**

1. Enter your high-level project objective in the input box (e.g., `Create a simple Python script that prints numbers 1 to 10`) and press Enter.
2. Nyx will use the Planner Agent (LLM) to generate a task plan, which will appear in the left panel.
3. It will then execute the tasks sequentially using the Worker Agent. Progress, logs, agent status, and statistics will update in real-time in the right panel.
4. Use `/exit` or `/quit` in the input box, or press `Ctrl+C`, `Esc`, or `q` to exit Nyx.

**Command-Line Options:**

* `--no-dashboard`: Run Nyx in headless mode without the interactive TUI. Logs and status updates will be printed directly to the console.
* `--model <model_name>`: Specify the OpenAI model to use (e.g., `--model gpt-3.5-turbo`). Overrides the `OPENAI_MODEL` environment variable and the default.
* `--help`: Display help information.

*(Note: Headless mode currently requires an objective provided via TBD mechanism - initial implementation focuses on dashboard input).*

## How it Works

Nyx follows a plan-and-execute architecture:

1. **Initialization:** Loads configuration (`.env`, CLI flags).
2. **Dashboard:** Launches the interactive terminal UI.
3. **Input:** Receives the user objective via the dashboard input.
4. **Planning:** The `Orchestrator` invokes the `PlannerAgent`, which uses an LLM (e.g., GPT-4) to break the objective into a `TaskGraph` (a list of tasks with dependencies).
5. **Execution:** The `Orchestrator` iterates through the `TaskGraph`. For each task, it invokes a `WorkerAgent`.
6. **Worker Action:** The `WorkerAgent` analyzes the task. It might:
    * Call the LLM to generate code or extract information (e.g., filenames, shell commands).
    * Use `Tools` (like `fileTool`, `shellTool`) to interact with the environment (write files, run commands). File operations are protected by a locking mechanism.
7. **Feedback Loop:** Task results (success, failure, output) are fed back to the Orchestrator. Failed tasks may be retried (up to 3 times by default).
8. **Observability:** Throughout the process, events are emitted and displayed on the dashboard (task status, logs, agent activity, stats).
9. **Completion:** Once all tasks are processed, the run finishes, and the dashboard awaits a new objective or exit command.

## Configuration

* **`OPENAI_API_KEY`** (Required): Your OpenAI API key. Set via `.env` file or environment variable.
* **`OPENAI_MODEL`** (Optional): The OpenAI model name (e.g., `gpt-4`, `gpt-3.5-turbo`). Set via `.env`, environment variable, or `--model` flag. Defaults to `gpt-4`.
* **`NYX_WORKSPACE_DIR`** (Optional): Specifies the root directory for file operations if you want to constrain Nyx. Defaults to the current working directory (`process.cwd()`). Set via environment variable.
* **CLI Flags:** See `Usage` section (`--no-dashboard`, `--model`).

## Limitations

* **Experimental:** Nyx is under development. The quality of generated code depends heavily on the LLM and the clarity of the objective.
* **Error Handling:** While retries are implemented, complex error diagnosis and recovery are still basic.
* **Context Window:** LLM context limits may affect performance on very large projects or long tasks.
* **Tool Reliability:** LLM extraction of filenames/commands from descriptions might fail, relying on regex fallbacks.
* **Testing:** Automated tests (unit/integration) are currently marked as TODOs.
* **Sandboxing:** Tool execution (especially shell commands) currently lacks robust sandboxing.

## Future Improvements

* Implement browser interaction and automated audits.
* Improve LLM prompt engineering and task execution strategies.
* Add more sophisticated error diagnosis and recovery.
* Implement robust testing suite.
* Introduce sandboxing for tool execution.
* Support for more complex task dependencies and parallel execution.
* Potential plugin system for custom tools/agents.

## Contributing

(TODO: Add contribution guidelines if applicable)

## License

(TODO: Specify license - currently ISC as per package.json)
