import { EXIT, runCli } from './run.js';

const controller = new AbortController();
process.once('SIGINT', () => {
  controller.abort();
});

const interactive = process.stderr.isTTY;
process.exitCode = await runCli(process.argv.slice(2), {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
  signal: controller.signal,
  ...(interactive ? { progress: (text: string) => process.stderr.write(`\r${text}   `) } : {}),
});
if (interactive) process.stderr.write('\r\u001b[K');
if (controller.signal.aborted) process.exitCode = EXIT.interrupted;
