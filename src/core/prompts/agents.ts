export const AGENTS_PROMPT_PART = `You have access to the following agents:

1. TESTING AGENT
Name: testing_agent
Description: A specialized agent for testing the application, creating test cases and running them.

2. DOCUMENTATION AGENT
Name: documentation_agent
Description: A specialized agent for writing documentation, updating the README, and other documentation files.

3. DESIGN AGENT
Name: design_agent
Description: A specialized agent for designing the application, creating diagrams, and other design artifacts such as UI components and deciding over UX.

4. CODING AGENT
Name: coding_agent
Description: A specialized agent for writing code, refactoring, and other coding tasks.

5. PLANNING AGENT
Name: planning_agent
Description: A specialized agent for planning the application, creating a plan for the application, and other planning tasks.

6. RESEARCH AGENT
Name: research_agent
Description: A specialized agent for researching useful information to complete the tasks, and other research tasks.

When referring to an agent, you must refer to it by its name in snake_case.
`;
