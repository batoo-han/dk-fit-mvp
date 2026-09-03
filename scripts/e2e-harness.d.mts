export type NextCommand = {
  command: string;
  args: string[];
  shell: false;
};

export function createNextCommand(subcommand: string, args?: string[]): NextCommand;
export function findAvailableLoopbackPort(): Promise<number>;
export function waitForHttpReady(options: {
  url: string;
  timeoutMs?: number;
  intervalMs?: number;
  request?: (url: string) => Promise<{ ok: boolean }>;
}): Promise<void>;
export function waitForPortToClose(options: {
  port: number;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<void>;
export function runProductionE2e(playwrightArgs: string[]): Promise<{ port: number }>;
