# src/cli/tui — Terminal UI

Interactive terminal UI for `ai-workflow`, built with [Ink](https://github.com/vadimdemedes/ink) (React for CLIs).

## Structure

```
tui/
├── index.js          # TUI entry point — renders App into the terminal
├── App.js            # Root application component; manages layout and state
├── helpers.js        # Shared helper utilities (formatting, keybindings)
├── hooks/
│   └── useOrchestrator.js  # React hook — subscribes to workflow engine events
└── components/
    ├── Header.js            # Top bar: project name, version, run ID
    ├── StatusBar.js         # Bottom bar: current status and elapsed time
    ├── StepsPanel.js        # Left panel: step list with status icons
    ├── StepDetailOverlay.js # Modal: detailed view of a selected step
    ├── LogPanel.js          # Right panel: live log output
    ├── LogSearchBar.js      # Log panel search/filter input
    ├── StreamViewer.js      # Streaming AI response viewer
    ├── ProgressBar.js       # Animated progress bar component
    ├── ErrorDetailPanel.js  # Error details with stack trace display
    └── HelpOverlay.js       # Keybinding help overlay (press ?)
```

## Usage

The TUI is activated automatically when `ai-workflow run` is invoked in an interactive terminal (TTY). In non-interactive environments (CI, pipes) the plain text logger is used instead.

```javascript
import { render } from 'ink';
import App from './App.js';

render(<App workflowEngine={engine} config={config} />);
```

## Dependencies

- **ink** `^6` — React renderer for the terminal
- **react** `^19` — Component model
- **ink-testing-library** (dev) — Unit testing for Ink components
