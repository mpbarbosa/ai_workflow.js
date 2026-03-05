// scripts/fix-markdown.test.js

import { fixContent } from './fix-markdown.js';

describe('fixContent', () => {
  it('should fix tab-indented list items outside code blocks (MD007)', () => {
    const input = '\t- Item 1\n\t* Item 2\n\t+ Item 3\n\t  Not a list\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('  - Item 1\n  * Item 2\n  + Item 3\n  Not a list\n');
    expect(changed).toBe(true);
  });

  it('should not change tab-indented lines inside code blocks', () => {
    const input = '
