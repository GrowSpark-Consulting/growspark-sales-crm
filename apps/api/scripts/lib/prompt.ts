import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export async function promptText(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/**
 * A masked password prompt. Node has no built-in hidden-input readline mode,
 * so this reads raw keypresses directly and echoes "*" instead of the real
 * character — the standard pattern for this (there is no simpler built-in
 * way that does not involve an extra dependency). Needs a real interactive
 * terminal; refuses immediately rather than hanging or silently reading
 * garbage if stdin is piped.
 */
export async function promptHidden(question: string): Promise<string> {
  if (!stdin.isTTY) {
    throw new Error('A password prompt needs an interactive terminal (stdin is not a TTY).');
  }

  return new Promise((resolve, reject) => {
    stdout.write(question);
    let input = '';

    const onData = (chunk: Buffer): void => {
      const char = chunk.toString('utf8');
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl-D
          cleanup();
          stdout.write('\n');
          resolve(input);
          break;
        case '\u0003': // Ctrl-C
          cleanup();
          stdout.write('\n');
          reject(new Error('Cancelled.'));
          break;
        case '\u007f': // backspace (DEL)
        case '\b':
          if (input.length > 0) {
            input = input.slice(0, -1);
            stdout.write('\b \b');
          }
          break;
        default:
          input += char;
          stdout.write('*'.repeat(char.length));
      }
    };

    const cleanup = (): void => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
  });
}
