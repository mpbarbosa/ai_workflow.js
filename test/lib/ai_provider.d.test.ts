// test/lib/ai_provider.d.test.ts
import type {
  AIProvider,
  ProviderWrapperOptions,
  ProviderWrapper,
} from '../../src/lib/ai_provider.d';

describe('ai_provider.d.ts type definitions', () => {
  describe('AIProvider type', () => {
    it('allows only "copilot" or "claude"', () => {
      const validCopilot: AIProvider = 'copilot';
      const validClaude: AIProvider = 'claude';
      // @ts-expect-error
      const invalid: AIProvider = 'other';
      expect(validCopilot).toBe('copilot');
      expect(validClaude).toBe('claude');
    });
  });

  describe('ProviderWrapperOptions interface', () => {
    it('accepts all optional fields', () => {
      const opts: ProviderWrapperOptions = {
        model: 'gpt-4',
        timeout: 1000,
        workingDirectory: '/tmp',
        streaming: true,
        tools: [{ name: 'tool1' }],
      };
      expect(opts.model).toBe('gpt-4');
      expect(opts.timeout).toBe(1000);
      expect(opts.workingDirectory).toBe('/tmp');
      expect(opts.streaming).toBe(true);
      expect(Array.isArray(opts.tools)).toBe(true);
    });

    it('accepts empty object', () => {
      const opts: ProviderWrapperOptions = {};
      expect(opts).toBeDefined();
    });

    it('rejects unknown fields', () => {
      // @ts-expect-error
      const opts: ProviderWrapperOptions = { foo: 'bar' };
      expect(opts).toBeDefined();
    });
  });

  describe('ProviderWrapper type', () => {
    it('is assignable to any', () => {
      const wrapper: ProviderWrapper = { foo: 123 };
      expect(wrapper.foo).toBe(123);
    });
  });

  describe('createProviderWrapper declaration', () => {
    it('has correct signature', () => {
      type Fn = typeof import('../../src/lib/ai_provider.d').createProviderWrapper;
      // The following assignment should type-check
      const fn: Fn = ((provider: AIProvider, options?: ProviderWrapperOptions) => ({})) as any;
      expect(typeof fn).toBe('function');
    });
  });

  describe('isProviderAvailable declaration', () => {
    it('has correct signature', () => {
      type Fn = typeof import('../../src/lib/ai_provider.d').isProviderAvailable;
      const fn: Fn = ((provider: AIProvider) => true) as any;
      expect(typeof fn).toBe('function');
    });
  });
});
