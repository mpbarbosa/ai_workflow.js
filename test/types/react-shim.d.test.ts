// @ts-nocheck
import React from '../../../src/types/react-shim';

describe('react-shim', () => {
  it('should have a Fragment symbol', () => {
    expect(typeof React.Fragment).toBe('symbol');
  });

  it('should create a ReactElement with type and props', () => {
    const element = React.createElement('div', { foo: 'bar' }, 'child');
    expect(element).toHaveProperty('type', 'div');
    expect(element).toHaveProperty('props');
    expect(element.props).toMatchObject({ foo: 'bar', children: 'child' });
    expect(element).toHaveProperty('key', null);
  });

  it('should create a ReactElement with no props', () => {
    const element = React.createElement('span');
    expect(element.type).toBe('span');
    expect(element.props).toEqual({});
    expect(element.key).toBeNull();
  });

  it('should handle multiple children', () => {
    const element = React.createElement('ul', null, 'a', 'b', 'c');
    expect(element.props.children).toEqual(['a', 'b', 'c']);
  });

  it('should allow key in props', () => {
    const element = React.createElement('li', { key: 42, value: 'x' });
    expect(element.key).toBe(42);
    expect(element.props.value).toBe('x');
  });

  it('should handle undefined type', () => {
    const element = React.createElement(undefined, { foo: 1 });
    expect(element.type).toBeUndefined();
    expect(element.props.foo).toBe(1);
  });

  it('should export default React', () => {
    expect(React).toBeDefined();
    expect(typeof React.createElement).toBe('function');
  });
});
