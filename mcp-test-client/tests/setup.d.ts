/**
 * Jest setup file for global test configuration
 */
export declare const mockConsole: {
    log: jest.SpyInstance<void, [message?: any, ...optionalParams: any[]], any>;
    info: jest.SpyInstance<void, [message?: any, ...optionalParams: any[]], any>;
    warn: jest.SpyInstance<void, [message?: any, ...optionalParams: any[]], any>;
    error: jest.SpyInstance<void, [message?: any, ...optionalParams: any[]], any>;
};
export declare const restoreConsole: () => void;
//# sourceMappingURL=setup.d.ts.map