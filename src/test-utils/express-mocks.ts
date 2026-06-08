/**
 * Shared Express request/response test doubles for controller unit tests.
 */

import { Request, Response } from 'express';

/** A chainable Response mock capturing status/json/setHeader calls. */
export const mockResponse = (): Response => {
    const res = {} as Record<string, jest.Mock>;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    return res as unknown as Response;
};

/** Build a Request with sensible empty defaults, overridable per test. */
export const mockRequest = (overrides: Record<string, unknown> = {}): Request => {
    return {
        params: {},
        query: {},
        body: {},
        headers: {},
        ...overrides,
    } as unknown as Request;
};

/** Extract the JSON body passed to res.json() in the first call. */
export const jsonBody = (res: Response): any => {
    return (res.json as unknown as jest.Mock).mock.calls[0]?.[0];
};

/** Extract the status code passed to res.status() in the first call. */
export const statusCode = (res: Response): number => {
    return (res.status as unknown as jest.Mock).mock.calls[0]?.[0];
};
