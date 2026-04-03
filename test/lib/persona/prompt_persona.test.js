import { describe, it, expect, vi, afterEach } from 'vitest';
import PromptPersona from '../../../src/lib/persona/prompt_persona';
import fs from 'fs';
import path from 'path';

describe('PromptPersona', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs with correct properties', () => {
    const p = new PromptPersona('id', 'name', '/tmp/x.json');
    expect(p.id).toBe('id');
    expect(p.name).toBe('name');
    expect(p.configPath).toBe('/tmp/x.json');
  });

  it('detectChanges returns true if file exists', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const p = new PromptPersona('id', 'name', '/tmp/x.json');
    expect(p.detectChanges()).toBe(true);
  });

  it('detectChanges returns false if file does not exist', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const p = new PromptPersona('id', 'name', '/tmp/x.json');
    expect(p.detectChanges()).toBe(false);
  });

  it('loadAll returns [] if personas dir missing', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(PromptPersona.loadAll()).toEqual([]);
  });

  it('loadAll loads personas from .json files', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/abs');
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (p) => p === path.resolve('/abs', '.workflow_core/personas')
    );
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['foo_bar.json', 'baz.json', 'notjson.txt']);
    const personas = PromptPersona.loadAll();
    expect(personas.length).toBe(2);
    expect(personas[0].id).toBe('foo_bar');
    expect(personas[0].name).toBe('foo bar');
    expect(personas[1].id).toBe('baz');
    expect(personas[1].name).toBe('baz');
  });
});
