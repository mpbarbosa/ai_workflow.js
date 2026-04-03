import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GitSubmodule from '../../../src/lib/git/git_submodule';
import fs from 'fs';

describe('GitSubmodule', () => {
  let execSyncMock;
  beforeEach(() => {
    execSyncMock = vi.spyOn(require('child_process'), 'execSync');
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs with correct properties', () => {
    const sub = new GitSubmodule('n', 'p', 'u', 'c');
    expect(sub.name).toBe('n');
    expect(sub.path).toBe('p');
    expect(sub.remoteUrl).toBe('u');
    expect(sub.currentCommit).toBe('c');
  });

  it('update() updates currentCommit on success', async () => {
    execSyncMock
      .mockImplementationOnce(() => {}) // update
      .mockImplementationOnce(() => Buffer.from('abc123\n')); // rev-parse
    const sub = new GitSubmodule('n', 'p', 'u', 'old');
    await sub.update();
    expect(sub.currentCommit).toBe('abc123');
    expect(execSyncMock).toHaveBeenCalledWith('git submodule update --remote p', {
      stdio: 'inherit',
    });
    expect(execSyncMock).toHaveBeenCalledWith('git -C p rev-parse HEAD');
  });

  it('update() throws on error', async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('fail');
    });
    const sub = new GitSubmodule('n', 'p', 'u', 'c');
    await expect(sub.update()).rejects.toThrow(/Failed to update submodule/);
  });

  it('loadAll() returns [] if .gitmodules missing', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(GitSubmodule.loadAll()).toEqual([]);
  });

  it('loadAll() parses submodules and gets commit', () => {
    const fakeGitmodules = `
[submodule "foo"]
  path = foo
  url = https://x
[submodule "bar"]
  path = bar
  url = https://y
`;
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (p) => (typeof p === 'string' && p.endsWith('.gitmodules')) || p === 'foo' || p === 'bar'
    );
    vi.spyOn(fs, 'readFileSync').mockReturnValue(fakeGitmodules);
    execSyncMock
      .mockImplementationOnce(() => Buffer.from('commit1\n'))
      .mockImplementationOnce(() => Buffer.from('commit2\n'));
    const subs = GitSubmodule.loadAll();
    expect(subs.length).toBe(2);
    expect(subs[0].name).toBe('foo');
    expect(subs[0].currentCommit).toBe('commit1');
    expect(subs[1].name).toBe('bar');
    expect(subs[1].currentCommit).toBe('commit2');
  });

  it('loadAll() sets commit to "" if rev-parse fails', () => {
    const fakeGitmodules = `
[submodule "foo"]
  path = foo
  url = https://x
`;
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(fakeGitmodules);
    execSyncMock.mockImplementation(() => {
      throw new Error('fail');
    });
    const subs = GitSubmodule.loadAll();
    expect(subs[0].currentCommit).toBe('');
  });
});
