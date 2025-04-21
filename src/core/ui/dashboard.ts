import * as blessed from 'blessed';
import { Task } from '../agents/task';
import { OrchestratorStats, Orchestrator } from '../orchestrator';

// TODO: Add tests for Dashboard UI logic (formatting, updates)
// Note: Testing TUI components directly can be tricky

export class Dashboard {
  private screen: blessed.Widgets.Screen;
  private taskListBox: blessed.Widgets.ListElement;
  private logBox: blessed.Widgets.Log;
  private agentStatusBox: blessed.Widgets.BoxElement;
  private statsBox: blessed.Widgets.TextElement;
  private inputBox: blessed.Widgets.TextboxElement;
  private orchestrator: Orchestrator;
  private objectiveSubmitted = false;

  constructor(orchestrator: Orchestrator) {
    this.orchestrator = orchestrator;

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Nyx',
      fullUnicode: true,
      dockBorders: true,
      autoPadding: true,
    });

    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.handleExit();
    });

    const topHeight = '95%';
    const inputHeight = 3;

    // Left Panel (Task List)
    this.taskListBox = blessed.list({
      parent: this.screen,
      label: ' Tasks ',
      width: '35%',
      height: topHeight,
      top: '0',
      left: '0',
      items: [' {grey-fg}Waiting for objective...{/grey-fg}'],
      border: 'line',
      style: {
        fg: 'white',
        bg: 'default',
        border: { fg: 'cyan' },
        selected: { bg: 'blue', fg: 'white' },
        item: { hover: { bg: 'blue' } },
      },
      tags: true,
      scrollable: true,
      mouse: true,
      keys: true,
      vi: true,
      scrollbar: {
        ch: ' ',
        track: { bg: 'grey' },
        style: { bg: 'cyan' },
      },
    });

    // Right Panel Container
    const rightPanelContainer = blessed.box({
      parent: this.screen,
      width: '65%',
      height: topHeight,
      top: '0',
      left: '35%',
    });

    // Right Panel Top: Logs
    this.logBox = blessed.log({
      parent: rightPanelContainer,
      label: ' Details & Logs ',
      width: '100%',
      height: '60%',
      top: '0',
      left: '0',
      border: 'line',
      tags: true,
      scrollable: true,
      mouse: true,
      keys: true,
      vi: true,
      scrollbar: {
        ch: ' ',
        track: { bg: 'grey' },
        style: { bg: 'cyan' },
      },
      style: {
        fg: 'white',
        bg: 'default',
        border: { fg: 'cyan' },
      },
    });

    // Right Panel Middle: Agent Status (Placeholder)
    this.agentStatusBox = blessed.box({
      parent: rightPanelContainer,
      label: ' Agent Status ',
      width: '100%',
      height: '20%',
      top: '60%',
      left: '0',
      border: 'line',
      content: ' {grey-fg}Idle{/grey-fg}',
      tags: true,
      scrollable: true,
      style: {
        fg: 'white',
        bg: 'default',
        border: { fg: 'yellow' },
      },
    });

    // Right Panel Bottom: Stats (Placeholder)
    this.statsBox = blessed.text({
      parent: rightPanelContainer,
      label: ' Stats ',
      width: '100%',
      height: '20%',
      top: '80%',
      left: '0',
      border: 'line',
      content: ' {grey-fg}Waiting...{/grey-fg}',
      tags: true,
      style: {
        fg: 'white',
        bg: 'default',
        border: { fg: 'green' },
      },
    });

    // Input Box at the bottom
    this.inputBox = blessed.textbox({
      parent: this.screen,
      label: ' Input (Enter objective or /exit) ',
      width: '100%',
      height: inputHeight,
      bottom: 0,
      left: '0',
      border: 'line',
      inputOnFocus: true,
      keys: true,
      mouse: true,
      style: {
        fg: 'white',
        bg: 'black',
        border: { fg: 'magenta' },
        focus: { border: { fg: 'blue' } },
      },
    });

    this.inputBox.focus();

    this.inputBox.on('submit', (value) => {
      const trimmedValue = value.trim();
      this.inputBox.clearValue();
      this.inputBox.focus();

      if (
        trimmedValue.toLowerCase() === '/exit' ||
        trimmedValue.toLowerCase() === '/quit'
      ) {
        this.handleExit();
        return;
      }

      if (!this.objectiveSubmitted) {
        if (trimmedValue) {
          this.log(`{blue-fg}YOU:{/} ${trimmedValue}`);

          this.objectiveSubmitted = true;
          this.inputBox.setLabel(' Input (Processing... Enter /exit to quit) ');
          this.screen.render();

          this.orchestrator
            .startProcessingObjective(trimmedValue)
            .finally(() => {
              this.inputBox.setLabel(' Input (Enter new objective or /exit) ');
              this.inputBox.focus();
              this.screen.render();
              this.objectiveSubmitted = false; // Ready for next objective
            });
        } else {
          this.log('{red-fg}Please enter an objective or /exit.{/red-fg}');
          this.screen.render();
        }
      } else {
        this.log(
          '{yellow-fg}Processing previous objective. Please wait or exit (/exit).{/yellow-fg}'
        );

        this.screen.render();
      }
    });

    this.log(
      'Welcome to Nyx! Please enter your project objective below and press Enter.'
    );

    this.screen.render();
  }

  private handleExit(): void {
    this.log('{yellow-fg}Exiting Nyx...{/yellow-fg}');
    this.screen.render();

    setTimeout(() => {
      this.destroy();
      process.exit(0);
    }, 100);
  }

  public updateTasks(tasks: Task[]): void {
    const taskItems = tasks.map(this.formatTaskLine);
    this.taskListBox.setItems(taskItems);
    this.screen.render();
  }

  public log(message: string): void {
    const msgString =
      typeof message === 'string' ? message : JSON.stringify(message);
    this.logBox.log(msgString);
    this.screen.render();
  }

  public markTaskStatus(taskId: number, status: string, tasks: Task[]): void {
    this.updateTasks(tasks);
  }

  public updateStats(stats: OrchestratorStats): void {
    const {
      elapsedSeconds,
      tasksTotal,
      tasksCompleted,
      tasksFailed,
      llmCalls,
    } = stats;

    const timeStr = new Date(elapsedSeconds * 1000).toISOString().slice(14, 19);
    const content = `  Time: ${timeStr} | Tasks: ${tasksCompleted}/${tasksTotal} (${tasksFailed} failed) | LLM Calls: ${llmCalls}`;

    this.statsBox.setContent(content);
    this.screen.render();
  }

  public updateAgentStatus(activeAgents: { [taskId: number]: string }): void {
    let content = '';
    const activeAgentEntries = Object.entries(activeAgents);

    if (activeAgentEntries.length === 0) {
      content = ' {grey-fg}Idle{/grey-fg}';
    } else {
      content = activeAgentEntries
        .map(([taskId, agentInfo]) => `  Task ${taskId}: ${agentInfo}`)
        .join('\n');
    }

    this.agentStatusBox.setContent(content);
    this.screen.render();
  }

  private formatTaskLine = (task: Task): string => {
    let statusMarker = '{grey-fg}[ ]{/grey-fg}';

    switch (task.status) {
      case 'in_progress':
        statusMarker = '{yellow-fg}[~]{/yellow-fg}';
        break;

      case 'completed':
        statusMarker = '{green-fg}[✔]{/green-fg}';
        break;

      case 'failed': {
        const retryInfo =
          task.retries && task.retries > 1
            ? ` (${task.retries - 1} retries)`
            : '';
        statusMarker = `{red-fg}[✖]${retryInfo}{/red-fg}`;
        break;
      }
    }

    return `${statusMarker} ${task.description} (ID: ${task.id})`;
  };

  public destroy(): void {
    this.screen.destroy();
  }
}
