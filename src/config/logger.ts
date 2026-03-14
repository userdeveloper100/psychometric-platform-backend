type Meta = Record<string, unknown> | unknown;

interface Logger {
    info: (message: string, meta?: Meta) => void;
    warn: (message: string, meta?: Meta) => void;
    error: (message: string, meta?: Meta) => void;
    debug: (message: string, meta?: Meta) => void;
}

const write = (level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: Meta) => {
    if (meta === undefined) {
        console[level](message);
        return;
    }
    console[level](message, meta);
};

const logger: Logger = {
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
    debug: (message, meta) => {
        if (process.env.NODE_ENV !== 'production') {
            write('debug', message, meta);
        }
    }
};

export default logger;