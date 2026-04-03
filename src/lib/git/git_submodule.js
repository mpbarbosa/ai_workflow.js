/**
 * @fileoverview GitSubmodule class for managing git submodules in ai_workflow.js
 * @module lib/git/git_submodule
 */

const { execSync } = require('child_process');

/**
 * Represents a Git submodule.
 */
class GitSubmodule {
  /**
   * @param {string} name - The submodule name.
   * @param {string} path - The submodule path.
   * @param {string} remoteUrl - The submodule remote URL.
   * @param {string} currentCommit - The current commit hash.
   */
  constructor(name, path, remoteUrl, currentCommit) {
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.path = path;
    /** @type {string} */
    this.remoteUrl = remoteUrl;
    /** @type {string} */
    this.currentCommit = currentCommit;
  }

  /**
   * Updates the submodule to the latest commit on its default branch.
   * @returns {Promise<void>}
   */
  async update() {
    try {
      execSync(`git submodule update --remote ${this.path}`, { stdio: 'inherit' });
      // Refresh currentCommit after update
      const commit = execSync(`git -C ${this.path} rev-parse HEAD`).toString().trim();
      this.currentCommit = commit;
    } catch (err) {
      throw new Error(`Failed to update submodule ${this.name}: ${err.message}`, { cause: err });
    }
  }

  /**
   * Loads all submodules from .gitmodules and returns an array of GitSubmodule instances.
   * @returns {GitSubmodule[]}
   */
  static loadAll() {
    const fs = require('fs');
    const path = require('path');
    const gitmodulesPath = path.resolve(process.cwd(), '.gitmodules');
    if (!fs.existsSync(gitmodulesPath)) return [];
    const content = fs.readFileSync(gitmodulesPath, 'utf8');
    const submodules = [];
    const regex = /\[submodule "(.*?)"\][\s\S]*?path = (.*?)\n[\s\S]*?url = (.*?)\n/g;
    let match;
    while ((match = regex.exec(content))) {
      const name = match[1];
      const subPath = match[2];
      const url = match[3];
      let commit;
      try {
        commit = execSync(`git -C ${subPath} rev-parse HEAD`).toString().trim();
      } catch {
        commit = '';
      }
      submodules.push(new GitSubmodule(name, subPath, url, commit));
    }
    return submodules;
  }
}

module.exports = GitSubmodule;
