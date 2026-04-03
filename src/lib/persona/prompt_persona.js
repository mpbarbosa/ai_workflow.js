/**
 * @fileoverview PromptPersona class for persona management in ai_workflow.js
 * @module lib/persona/prompt_persona
 */

const fs = require('fs');
const path = require('path');

/**
 * Represents a prompt persona.
 */
class PromptPersona {
  /**
   * @param {string} id - Persona ID.
   * @param {string} name - Persona name.
   * @param {string} configPath - Path to persona config file.
   */
  constructor(id, name, configPath) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.configPath = configPath;
  }

  /**
   * Detects if the persona config file has changed since last check.
   * @returns {boolean}
   */
  detectChanges() {
    // For demonstration, always returns true if file exists.
    // In production, compare file mtime or hash with stored value.
    return fs.existsSync(this.configPath);
  }

  /**
   * Loads all personas from the .workflow_core/personas directory.
   * @returns {PromptPersona[]}
   */
  static loadAll() {
    const personasDir = path.resolve(process.cwd(), '.workflow_core/personas');
    if (!fs.existsSync(personasDir)) return [];
    const files = fs.readdirSync(personasDir).filter((f) => f.endsWith('.json'));
    return files.map((f) => {
      const id = path.basename(f, '.json');
      const name = id.replace(/_/g, ' ');
      const configPath = path.join(personasDir, f);
      return new PromptPersona(id, name, configPath);
    });
  }
}

module.exports = PromptPersona;
