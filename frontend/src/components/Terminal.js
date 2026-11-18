import React, { useState, useRef, useEffect } from 'react';

const Terminal = ({ commandHistory, onCommandSubmit }) => {
  const [command, setCommand] = useState('');
  const terminalRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom of terminal when command history changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [commandHistory]);

  // Focus input when terminal is clicked
  const handleTerminalClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleCommandChange = (e) => {
    setCommand(e.target.value);
  };

  const handleCommandSubmit = (e) => {
    e.preventDefault();
    if (command.trim()) {
      onCommandSubmit(command.trim());
      setCommand('');
    }
  };

  return (
    <div className="terminal-container">
      <div className="terminal" ref={terminalRef} onClick={handleTerminalClick}>
        {commandHistory.length === 0 && (
          <div className="terminal-hint">
            Run the commands listed under <strong>Instructions</strong> here to move to the next step.
          </div>
        )}
        {commandHistory.map((item, index) => (
          <div key={index} className="terminal-line">
            <div className="terminal-command-line">
              <span className="terminal-prompt">$</span>
              <span className="terminal-command-text">{item.command}</span>
            </div>
            {item.output && (
              <pre className="terminal-output">{item.output}</pre>
            )}
          </div>
        ))}
      </div>
      <form className="terminal-input" onSubmit={handleCommandSubmit}>
        <span className="terminal-prompt">$</span>
        <input
          type="text"
          className="terminal-command"
          value={command}
          onChange={handleCommandChange}
          ref={inputRef}
          autoFocus
          placeholder="Type your command here..."
        />
      </form>
    </div>
  );
};

export default Terminal;
