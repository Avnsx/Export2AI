import * as vscode from "vscode";

const CONFIG_SECTION = "export2ai";

export const OUTPUT_CHANNEL_NAME = "Export2AI";

let outputChannel: vscode.OutputChannel | undefined;

export interface DebugLogOptions {
  resource?: vscode.Uri;
  details?: Record<string, unknown>;
  show?: boolean;
}

export function setDebugOutputChannel(channel: vscode.OutputChannel | undefined): void {
  outputChannel = channel;
}

export function getDebugOutputChannel(): vscode.OutputChannel | undefined {
  return outputChannel;
}

export function isDebugLoggingEnabled(resource?: vscode.Uri): boolean {
  const configTarget = resource ?? vscode.workspace.workspaceFolders?.[0]?.uri;
  return vscode.workspace.getConfiguration(CONFIG_SECTION, configTarget).get<boolean>("debug", false);
}

export function formatLocalCompactTimestamp(date = new Date()): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date).replace(/\u202f|\u00a0/g, " ");
  } catch {
    const pad = (value: number) => String(value).padStart(2, "0");
    return [
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    ].join(" ");
  }
}

function singleLine(value: string): string {
  return value.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
}

function formatValue(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (value instanceof Error) {
    return singleLine(value.stack ?? value.message);
  }
  if (value instanceof vscode.Uri) {
    return value.toString();
  }
  if (typeof value === "string") {
    return singleLine(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return singleLine(JSON.stringify(value));
  } catch {
    return singleLine(String(value));
  }
}

export function formatDebugDetails(details?: Record<string, unknown>): string {
  if (!details) {
    return "";
  }

  return Object.entries(details)
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(" ");
}

export function formatDebugLogLine(
  message: string,
  date = new Date(),
  details?: Record<string, unknown>
): string {
  const detailText = formatDebugDetails(details);
  return `[${OUTPUT_CHANNEL_NAME} ${formatLocalCompactTimestamp(date)}] ${message}${detailText ? ` ${detailText}` : ""}`;
}

function revealDebugOutputChannel(): void {
  const channel = outputChannel;
  if (!channel) {
    return;
  }

  channel.show(false);
  setTimeout(() => channel.show(false), 100);
}

export function debugLog(message: string, options: DebugLogOptions = {}): void {
  if (!isDebugLoggingEnabled(options.resource)) {
    return;
  }

  const line = formatDebugLogLine(message, new Date(), options.details);
  outputChannel?.appendLine(line);
  console.log(line);

  if (options.show) {
    revealDebugOutputChannel();
  }
}

export function debugError(
  message: string,
  error?: unknown,
  options: DebugLogOptions = {}
): void {
  if (error !== undefined) {
    console.error(`Export2AI: ${message}`, error);
  } else {
    console.error(`Export2AI: ${message}`);
  }

  debugLog(message, {
    ...options,
    details: {
      ...(options.details ?? {}),
      ...(error === undefined ? {} : { error })
    }
  });
}
