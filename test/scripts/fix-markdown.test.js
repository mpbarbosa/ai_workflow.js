// test/scripts/fix-markdown.test.js

import { fixContent } from '../../scripts/fix-markdown.js';

describe('fixContent', () => {
  // MD007 – tab-indented list items
  it('fixes tab-indented list items outside code blocks (MD007)', () => {
    const input = '\t- Item 1\n\t* Item 2\n\t+ Item 3\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('  - Item 1\n  * Item 2\n  + Item 3\n');
    expect(changed).toBe(true);
  });

  it('converts each leading tab to 2 spaces (multi-tab indent)', () => {
    const input = '\t\t- Nested\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('    - Nested\n');
    expect(changed).toBe(true);
  });

  it('replaces leading tab on non-list indented lines too', () => {
    // \t  Not a list → leading tab → 2 spaces + existing 2 spaces = 4 spaces
    const input = '\t  Not a list\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('    Not a list\n');
    expect(changed).toBe(true);
  });

  it('preserves tab-indented lines inside code blocks (tabs not converted)', () => {
    const input = '```\n\t- Item 1\n\t* Item 2\n```\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('```\n\t- Item 1\n\t* Item 2\n```\n');
    expect(changed).toBe(false);
  });

  // MD009 – trailing whitespace
  it('strips trailing whitespace on every line (MD009)', () => {
    const input = 'Line with space   \nLine with tab\t\nLine clean\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('Line with space\nLine with tab\nLine clean\n');
    expect(changed).toBe(true);
  });

  it('strips trailing whitespace inside code blocks (tabs at end stripped)', () => {
    const input = '```\ncode with space   \ncode with tab\t\n```\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('```\ncode with space\ncode with tab\n```\n');
    expect(changed).toBe(true);
  });

  it('lines containing only tabs are stripped to empty (MD009 before MD007)', () => {
    // Tab-only lines: MD009 removes them before MD007 can convert
    const input = '\t\n\t\t\n- List item\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('\n\n- List item\n');
    expect(changed).toBe(true);
  });

  // MD026 – trailing punctuation on headings
  it('removes trailing punctuation on headings (MD026)', () => {
    const input = '# Heading.\n## Another!\n### Semi;\n#### Colon:\n##### Comma,\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('# Heading\n## Another\n### Semi\n#### Colon\n##### Comma\n');
    expect(changed).toBe(true);
  });

  it('does not remove "?" from headings (FAQ exception)', () => {
    const input = '# Is this a FAQ?\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('# Is this a FAQ?\n');
    expect(changed).toBe(false);
  });

  it('applies MD009 then MD026 (trailing spaces stripped before punctuation check)', () => {
    const input = '# Heading!   \n## Another Heading.  \n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('# Heading\n## Another Heading\n');
    expect(changed).toBe(true);
  });

  it('does not apply MD026 to non-heading lines', () => {
    const input = 'Some text.\nAnother sentence!\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('Some text.\nAnother sentence!\n');
    expect(changed).toBe(false);
  });

  // MD047 – missing final newline
  it('adds missing final newline (MD047)', () => {
    const input = '# Heading';
    const { content, changed } = fixContent(input);
    expect(content).toBe('# Heading\n');
    expect(changed).toBe(true);
  });

  it('does not add extra newline if already present', () => {
    const input = '# Heading\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('# Heading\n');
    expect(changed).toBe(false);
  });

  it('handles empty input (adds newline)', () => {
    const input = '';
    const { content, changed } = fixContent(input);
    expect(content).toBe('\n');
    expect(changed).toBe(true);
  });

  // Mixed / compound cases
  it('fixes heading punctuation but preserves non-heading trailing punctuation', () => {
    const input = '# Heading!\nSome text.  \n```\n\t- code list\ncode line   \n```\n- List item\n';
    const { content, changed } = fixContent(input);
    // MD026 on heading, MD009 on "Some text.  " → "Some text." (period stays), code tabs preserved
    expect(content).toBe(
      '# Heading\nSome text.\n```\n\t- code list\ncode line\n```\n- List item\n'
    );
    expect(changed).toBe(true);
  });

  it('handles ~~~ fenced code blocks (tabs preserved inside)', () => {
    const input = '~~~\n\tcode block\n~~~\n# Heading!\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('~~~\n\tcode block\n~~~\n# Heading\n');
    expect(changed).toBe(true);
  });

  it('handles multiple alternating code blocks and markdown', () => {
    const input =
      '# Heading!\n```\n\tcode block  \n```\n- List item\t\n~~~\n\tanother code block\t\n~~~\n';
    const { content, changed } = fixContent(input);
    // heading fixed, trailing ws in/out code blocks stripped, tabs in code blocks preserved
    expect(content).toBe(
      '# Heading\n```\n\tcode block\n```\n- List item\n~~~\n\tanother code block\n~~~\n'
    );
    expect(changed).toBe(true);
  });

  it('does not change already-clean content', () => {
    const input = '# Heading\n- List item\nSome text\n';
    const { content, changed } = fixContent(input);
    expect(content).toBe('# Heading\n- List item\nSome text\n');
    expect(changed).toBe(false);
  });
});
