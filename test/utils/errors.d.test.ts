import {
  WorkflowError,
  ConfigError,
  SystemError,
  ValidationError,
  StepError,
  AiError,
} from '../../src/utils/errors';

describe('WorkflowError hierarchy', () => {
  describe('WorkflowError', () => {
    it('should create an instance with message', () => {
      const err = new WorkflowError('Test message');
      expect(err).toBeInstanceOf(WorkflowError);
      expect(err.message).toBe('Test message');
      expect(err.code).toBeUndefined();
      expect(err.details).toBeUndefined();
    });

    it('should set code and details if provided', () => {
      const details = { foo: 1 };
      const err = new WorkflowError('msg', 'E123', details);
      expect(err.code).toBe('E123');
      expect(err.details).toEqual(details);
    });

    it('should inherit from Error', () => {
      const err = new WorkflowError('msg');
      expect(err).toBeInstanceOf(Error);
    });

    it('should handle empty message', () => {
      const err = new WorkflowError('');
      expect(err.message).toBe('');
    });

    it('should handle undefined details', () => {
      // @ts-expect-error
      const err = new WorkflowError('msg', 'E', undefined);
      expect(err.details).toBeUndefined();
    });
  });

  describe('ConfigError', () => {
    it('should create an instance with message', () => {
      const err = new ConfigError('Config failed');
      expect(err).toBeInstanceOf(ConfigError);
      expect(err).toBeInstanceOf(WorkflowError);
      expect(err.message).toBe('Config failed');
    });

    it('should set code and details', () => {
      const err = new ConfigError('fail', 'C1', { path: '/foo' });
      expect(err.code).toBe('C1');
      expect(err.details).toEqual({ path: '/foo' });
    });
  });

  describe('SystemError', () => {
    it('should create an instance with message', () => {
      const err = new SystemError('System down');
      expect(err).toBeInstanceOf(SystemError);
      expect(err).toBeInstanceOf(WorkflowError);
      expect(err.message).toBe('System down');
    });

    it('should set code and details', () => {
      const err = new SystemError('fail', 'S1', { os: 'linux' });
      expect(err.code).toBe('S1');
      expect(err.details).toEqual({ os: 'linux' });
    });
  });

  describe('ValidationError', () => {
    it('should create an instance with message', () => {
      const err = new ValidationError('Invalid input');
      expect(err).toBeInstanceOf(ValidationError);
      expect(err).toBeInstanceOf(WorkflowError);
      expect(err.message).toBe('Invalid input');
    });

    it('should set code and details', () => {
      const err = new ValidationError('fail', 'V1', { field: 'name' });
      expect(err.code).toBe('V1');
      expect(err.details).toEqual({ field: 'name' });
    });
  });

  describe('StepError', () => {
    it('should create an instance with message', () => {
      const err = new StepError('Step failed');
      expect(err).toBeInstanceOf(StepError);
      expect(err).toBeInstanceOf(WorkflowError);
      expect(err.message).toBe('Step failed');
    });

    it('should set code and details', () => {
      const err = new StepError('fail', 'ST1', { step: 3 });
      expect(err.code).toBe('ST1');
      expect(err.details).toEqual({ step: 3 });
    });
  });

  describe('AiError', () => {
    it('should create an instance with message', () => {
      const err = new AiError('AI failed');
      expect(err).toBeInstanceOf(AiError);
      expect(err).toBeInstanceOf(WorkflowError);
      expect(err.message).toBe('AI failed');
    });

    it('should set code and details', () => {
      const err = new AiError('fail', 'AI1', { model: 'gpt' });
      expect(err.code).toBe('AI1');
      expect(err.details).toEqual({ model: 'gpt' });
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle non-string message', () => {
      // @ts-expect-error
      const err = new WorkflowError(123 as any);
      expect(typeof err.message).toBe('string');
    });

    it('should handle null code', () => {
      // @ts-expect-error
      const err = new WorkflowError('msg', null);
      expect(err.code).toBeNull();
    });

    it('should handle null details', () => {
      // @ts-expect-error
      const err = new WorkflowError('msg', 'E', null);
      expect(err.details).toBeNull();
    });

    it('should handle details as empty object', () => {
      const err = new WorkflowError('msg', 'E', {});
      expect(err.details).toEqual({});
    });
  });
});
