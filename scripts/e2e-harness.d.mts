export type NextCommand = {
  command: string;
  args: string[];
  shell: false;
};

export const standaloneRuntimeCopyOptions: Readonly<{ dereference: true; recursive: true }>;
export const NEXT_LOCAL_ENV_FILENAMES: readonly string[];

export function assertNode24(nodeVersion?: string): void;
export function createNextCommand(subcommand: string, args?: string[]): NextCommand;
export function createStandaloneRuntimeLayout(options: {
  buildDirectory: string;
  runtimeDirectory: string;
}): Array<{ from: string; to: string }>;
export function createStandaloneServerCommand(options: {
  port: number;
  runtimeDirectory: string;
}): NextCommand & { cwd: string; env: Record<string, string> };
export function getNextLocalEnvironmentPaths(options?: { projectRoot?: string }): string[];
export function materializeStandaloneRuntime(options: {
  buildDirectory: string;
  runtimeDirectory: string;
}): Promise<void>;
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
export function withQuarantinedEnvironment<T>(options: {
  environmentPaths: string[];
  quarantineDirectory: string;
  recoveryDirectory?: string;
  renameFile?: (from: string, to: string) => Promise<void>;
  pathExists?: (targetPath: string) => Promise<boolean>;
}, run: () => Promise<T>): Promise<T>;
export function cleanupProductionE2eWorkspace(options: {
  temporaryRoot: string;
}): Promise<void>;
