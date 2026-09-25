type Level = 'info' | 'warn' | 'error';

function write(level: Level, msg: string, extra?: unknown) {
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${msg}`;
  const out = level === 'info' ? console.log : console.error;
  if (extra === undefined) out(line);
  else out(line, extra instanceof Error ? extra.message : extra);
}

export const log = {
  info: (msg: string, extra?: unknown) => write('info', msg, extra),
  warn: (msg: string, extra?: unknown) => write('warn', msg, extra),
  error: (msg: string, extra?: unknown) => write('error', msg, extra),
};
