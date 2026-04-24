// test/lib/ai_provider.test.js
import { createProviderWrapper, isProviderAvailable } from '../../src/lib/ai_provider.js';

jest.mock('../../src/lib/copilot_sdk_wrapper.js', () => {
    return {
        CopilotSdkWrapper: jest.fn().mockImplementation(opts => {
            return { __type: 'CopilotSdkWrapper', opts };
        }),
    };
});
jest.mock('../../src/lib/claude_sdk_wrapper.js', () => {
    return {
        ClaudeProviderWrapper: jest.fn().mockImplementation(opts => {
            return { __type: 'ClaudeProviderWrapper', opts };
        }),
    };
});

const { CopilotSdkWrapper } = require('../../src/lib/copilot_sdk_wrapper.js');
const { ClaudeProviderWrapper } = require('../../src/lib/claude_sdk_wrapper.js');

describe('ai_provider', () => {
    beforeEach(() => {
        CopilotSdkWrapper.mockClear();
        ClaudeProviderWrapper.mockClear();
        CopilotSdkWrapper.isAvailable = jest.fn(() => true);
        ClaudeProviderWrapper.isAvailable = jest.fn(() => true);
    });

    describe('createProviderWrapper', () => {
        it('creates a CopilotSdkWrapper by default', () => {
            const wrapper = createProviderWrapper();
            expect(CopilotSdkWrapper).toHaveBeenCalledWith({
                model: undefined,
                timeout: undefined,
                workingDirectory: undefined,
            });
            expect(wrapper.__type).toBe('CopilotSdkWrapper');
        });

        it('creates a CopilotSdkWrapper with all options', () => {
            const opts = {
                model: 'gpt-4',
                timeout: 5000,
                workingDirectory: '/tmp',
                streaming: true,
                tools: ['tool1', 'tool2'],
            };
            const wrapper = createProviderWrapper('copilot', opts);
            expect(CopilotSdkWrapper).toHaveBeenCalledWith({
                model: 'gpt-4',
                timeout: 5000,
                workingDirectory: '/tmp',
                streaming: true,
                tools: ['tool1', 'tool2'],
            });
            expect(wrapper.__type).toBe('CopilotSdkWrapper');
        });

        it('does not include streaming/tools if not provided', () => {
            const opts = { model: 'gpt-4' };
            createProviderWrapper('copilot', opts);
            expect(CopilotSdkWrapper).toHaveBeenCalledWith({
                model: 'gpt-4',
                timeout: undefined,
                workingDirectory: undefined,
            });
        });

        it('creates a ClaudeProviderWrapper when provider is "claude"', () => {
            const opts = {
                model: 'claude-3',
                timeout: 10000,
                workingDirectory: '/claude',
                streaming: true,
                tools: ['irrelevant'],
            };
            const wrapper = createProviderWrapper('claude', opts);
            expect(ClaudeProviderWrapper).toHaveBeenCalledWith({
                model: 'claude-3',
                timeout: 10000,
                workingDirectory: '/claude',
            });
            expect(wrapper.__type).toBe('ClaudeProviderWrapper');
        });

        it('handles missing options gracefully', () => {
            const wrapper = createProviderWrapper('claude');
            expect(ClaudeProviderWrapper).toHaveBeenCalledWith({
                model: undefined,
                timeout: undefined,
                workingDirectory: undefined,
            });
            expect(wrapper.__type).toBe('ClaudeProviderWrapper');
        });

        it('falls back to CopilotSdkWrapper for unknown provider', () => {
            const wrapper = createProviderWrapper('unknown', { model: 'x' });
            expect(CopilotSdkWrapper).toHaveBeenCalledWith({
                model: 'x',
                timeout: undefined,
                workingDirectory: undefined,
            });
            expect(wrapper.__type).toBe('CopilotSdkWrapper');
        });
    });

    describe('isProviderAvailable', () => {
        it('returns true if CopilotSdkWrapper.isAvailable returns true', () => {
            CopilotSdkWrapper.isAvailable = jest.fn(() => true);
            expect(isProviderAvailable('copilot')).toBe(true);
            expect(CopilotSdkWrapper.isAvailable).toHaveBeenCalled();
        });

        it('returns false if CopilotSdkWrapper.isAvailable returns false', () => {
            CopilotSdkWrapper.isAvailable = jest.fn(() => false);
            expect(isProviderAvailable('copilot')).toBe(false);
        });

        it('returns true if ClaudeProviderWrapper.isAvailable returns true', () => {
            ClaudeProviderWrapper.isAvailable = jest.fn(() => true);
            expect(isProviderAvailable('claude')).toBe(true);
            expect(ClaudeProviderWrapper.isAvailable).toHaveBeenCalled();
        });

        it('returns false if ClaudeProviderWrapper.isAvailable returns false', () => {
            ClaudeProviderWrapper.isAvailable = jest.fn(() => false);
            expect(isProviderAvailable('claude')).toBe(false);
        });

        it('defaults to CopilotSdkWrapper for unknown provider', () => {
            CopilotSdkWrapper.isAvailable = jest.fn(() => true);
            expect(isProviderAvailable('unknown')).toBe(true);
            expect(CopilotSdkWrapper.isAvailable).toHaveBeenCalled();
        });
    });
});
