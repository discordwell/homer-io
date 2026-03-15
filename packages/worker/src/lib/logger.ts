type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function log(level: LogLevel, msg: string, fields?: Record<string, unknown>) {
  const entry = { level, msg, time: new Date().toISOString(), ...fields };
  if (level === 'error') console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

export const logger = {
  info: (msg: string, fields?: Record<string, unknown>) => log('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => log('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => log('error', msg, fields),
  debug: (msg: string, fields?: Record<string, unknown>) => log('debug', msg, fields),
  child: (defaults: Record<string, unknown>) => ({
    info: (msg: string, f?: Record<string, unknown>) => log('info', msg, { ...defaults, ...f }),
    warn: (msg: string, f?: Record<string, unknown>) => log('warn', msg, { ...defaults, ...f }),
    error: (msg: string, f?: Record<string, unknown>) => log('error', msg, { ...defaults, ...f }),
    debug: (msg: string, f?: Record<string, unknown>) => log('debug', msg, { ...defaults, ...f }),
  }),
};
