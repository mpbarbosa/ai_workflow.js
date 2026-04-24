// test/lib/claude_sdk_wrapper.test.js
import { ClaudeProviderWrapper } from '../../src/lib/claude_sdk_wrapper.js';

const mockQuery = jest.fn();
const mockModule = { query: mockQuery };
const mockClaudeSdkWrapperInstance = {
    run: jest.fn(),
};

jest.mock('olinda_copilot_sdk.ts', () => ({
    ClaudeSdkWrapper: jest.fn().mockImplementation(opts => {
        return mockClaudeSdkWrapperInstance;
    }),
}), { virtual: true });

describe('ClaudeProviderWrapper', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('sets options and default timeout', () => {
            const wrapper = new ClaudeProviderWrapper({ model: 'claude-3' });
            expect(wrapper._opts).toEqual({ model: 'claude-3' });
            expect(wrapper._timeout).toBe(120000);
        });

        it('uses provided timeout', () => {
            const wrapper = new ClaudeProviderWrapper({ timeout: 5000 });
            expect(wrapper._timeout).toBe(5000);
        });
    });

    describe('isAvailable', () => {
        let originalCreateRequire;
        beforeAll(() => {
            originalCreateRequire = jest.requireActual('module').createRequire;
        });

        afterEach(() => {
            jest.resetModules();
        });

        it('returns true if module is importable and has query function', () => {
            const fakeRequire = jest.fn(() => ({ query: () => {} }));
            jest.spyOn(require('module'), 'createRequire').mockReturnValue(fakeRequire);
            // Re-import to use the mocked createRequire
            const { ClaudeProviderWrapper: Reloaded } = require('../../src/lib/claude_sdk_wrapper.js');
            expect(Reloaded.isAvailable()).toBe(true);
        });

        it('returns false if module import throws', () => {
            const fakeRequire = jest.fn(() => { throw new Error('not found'); });
            jest.spyOn(require('module'), 'createRequire').mockReturnValue(fakeRequire);
            const { ClaudeProviderWrapper: Reloaded } = require('../../src/lib/claude_sdk_wrapper.js');
            expect(Reloaded.isAvailable()).toBe(false);
        });

        it('returns false if module does not have query function', () => {
            const fakeRequire = jest.fn(() => ({}));
            jest.spyOn(require('module'), 'createRequire').mockReturnValue(fakeRequire);
            const { ClaudeProviderWrapper: Reloaded } = require('../../src/lib/claude_sdk_wrapper.js');
            expect(Reloaded.isAvailable()).toBe(false);
        });
    });

    describe('_getInner', () => {
        it('lazily loads and caches the inner SDK', async () => {
            const wrapper = new ClaudeProviderWrapper({ model: 'claude-3', workingDirectory: '/tmp' });
            wrapper._inner = null;
            const inner = await wrapper._getInner();
            expect(inner).toBe(mockClaudeSdkWrapperInstance);
            // Should cache the instance
            const inner2 = await wrapper._getInner();
            expect(inner2).toBe(inner);
        });

        it('propagates import errors', async () => {
            jest.resetModules();
            jest.doMock('olinda_copilot_sdk.ts', () => { throw new Error('fail import'); }, { virtual: true });
            const { ClaudeProviderWrapper: Reloaded } = require('../../src/lib/claude_sdk_wrapper.js');
            const wrapper = new Reloaded();
            await expect(wrapper._getInner()).rejects.toThrow('fail import');
        });
    });

    describe('initialize', () => {
        it('always resolves with authenticated true and empty availableModels', async () => {
            const wrapper = new ClaudeProviderWrapper();
            await expect(wrapper.initialize()).resolves.toEqual({ authenticated: true, availableModels: [] });
        });
    });

    describe('send', () => {
        beforeEach(() => {
            mockClaudeSdkWrapperInstance.run.mockReset();
        });

        it('returns assistant response on success', async () => {
            mockClaudeSdkWrapperInstance.run.mockResolvedValue({ content: 'hi', success: true });
            const wrapper = new ClaudeProviderWrapper({ model: 'claude-3' });
            const res = await wrapper.send('hello');
            expect(res).toEqual({ content: 'hi', success: true });
            expect(mockClaudeSdkWrapperInstance.run).toHaveBeenCalledWith('hello');
        });

        it('uses timeoutMs override', async () => {
            mockClaudeSdkWrapperInstance.run.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ content: 'ok', success: true }), 10)));
            const wrapper = new ClaudeProviderWrapper({ timeout: 100 });
            await expect(wrapper.send('test', 5)).rejects.toThrow(/timeout/i);
        });

        it('throws if inner.run rejects', async () => {
            mockClaudeSdkWrapperInstance.run.mockRejectedValue(new Error('run failed'));
            const wrapper = new ClaudeProviderWrapper();
            await expect(wrapper.send('fail')).rejects.toThrow('run failed');
        });

        it('clears timeout after completion', async () => {
            jest.useFakeTimers();
            mockClaudeSdkWrapperInstance.run.mockResolvedValue({ content: 'done', success: true });
            const wrapper = new ClaudeProviderWrapper({ timeout: 50 });
            const sendPromise = wrapper.send('foo');
            jest.runAllTimers();
            await expect(sendPromise).resolves.toEqual({ content: 'done', success: true });
            jest.useRealTimers();
        });
    });

    describe('recreateSession', () => {
        it('is a no-op', async () => {
            const wrapper = new ClaudeProviderWrapper();
            await expect(wrapper.recreateSession()).resolves.toBeUndefined();
        });
    });

    describe('cleanup', () => {
        it('is a no-op', async () => {
            const wrapper = new ClaudeProviderWrapper();
            await expect(wrapper.cleanup()).resolves.toBeUndefined();
        });
    });
});
