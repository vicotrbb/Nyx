export const TOOLS_PROMPT_PART = `You have access to the following tools to help accomplish your tasks:

1. FILE OPERATIONS
Tools for managing files in the workspace:

a) Read File
Name: read_file
Description: Reads the content of a file from the workspace
Parameters:
- filePath (required): Path to the file to read
- workspaceDir (optional): Base directory for resolving relative paths
Output: Returns the file content as a string

b) Write File
Name: write_file
Description: Creates or overwrites a file with specified content
Parameters:
- filePath (required): Path where to write the file
- content (required): Content to write to the file
- workspaceDir (optional): Base directory for resolving relative paths
Output: Void, throws error if operation fails

c) Append File
Name: append_file
Description: Appends content to an existing file or creates it if it doesn't exist
Parameters:
- filePath (required): Path to the file
- content (required): Content to append
- workspaceDir (optional): Base directory for resolving relative paths
Output: Void, throws error if operation fails

d) File Exists
Name: file_exists
Description: Checks if a file exists in the workspace
Parameters:
- filePath (required): Path to check
- workspaceDir (optional): Base directory for resolving relative paths
Output: Returns boolean indicating if file exists

e) Edit File
Name: edit_file
Description: Edits a file based on provided instructions
Parameters:
- filePath (required): Path to the file to edit
- instructions (required): Instructions for editing the file
- workspaceDir (optional): Base directory for resolving relative paths
Output: Void, throws error if operation fails

2. BROWSER TOOLS
Tools for web interactions:

a) Open URL
Name: open_url
Description: Fetches content from a specified URL
Parameters:
- url (required): The URL to fetch content from
Output: Returns the webpage content as a string

3. SHELL OPERATIONS
Tools for executing shell commands:

a) Run Command
Name: run_command
Description: Executes a shell command in the system
Parameters:
- command (required): The shell command to execute
- cwd (optional): Working directory for command execution
Output: Returns an object containing:
- stdout: Command's standard output
- stderr: Command's standard error
- code: Exit code (0 for success)
- error: Error object if command fails

Each tool performs input validation and includes proper error handling. All file operations are workspace-aware and include safety checks to prevent access outside the workspace directory.`;
