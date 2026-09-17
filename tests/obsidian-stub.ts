/**
 * Minimal stub standing in for the 'obsidian' package in unit tests.
 * The real package ships type declarations only (the runtime is provided
 * by the Obsidian app), so vitest aliases 'obsidian' to this file and
 * individual tests override what they need with vi.mock.
 */

export async function requestUrl(): Promise<never> {
  throw new Error('requestUrl is not mocked in this test');
}

export class Notice {
  constructor(_message?: string, _timeout?: number) {}
  setMessage(_message: string): void {}
  hide(): void {}
}

export class Plugin {}
export class SecretStorage {}
export class PluginSettingTab {}
export class Setting {}
export class TFile {}
export class App {}
export class Editor {}
export class MarkdownView {}
export class Menu {}
