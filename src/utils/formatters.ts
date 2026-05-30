export type OutputFormat = "plaintext" | "markdown" | "xml";

export class OutputFormatter {
  public static formatProjectStructureOnly(format: OutputFormat, projectTree: string): string {
    switch (format) {
      case "markdown": {
        const fence = this.getMarkdownFence(projectTree);
        return `# Project Structure\n\n${fence}\n${projectTree}${fence}\n`;
      }
      case "xml":
        return `<?xml version="1.0" encoding="UTF-8"?>\n<export2ai>\n` +
          `  <project_structure>\n` +
          projectTree.split("\n")
            .map(line => `    ${this.escapeXML(line)}`)
            .join("\n") +
          `\n  </project_structure>\n</export2ai>`;
      case "plaintext":
      default:
        return `Project Structure:\n\n${projectTree}\n`;
    }
  }

  private static escapeXML(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  public static getMarkdownFence(content: string): string {
    const backtickSequences = content.match(/`{3,}/g);
    if (!backtickSequences) {
      return "```";
    }
    const longestSequence = backtickSequences.reduce(
      (max, sequence) => Math.max(max, sequence.length),
      0
    );
    return "`".repeat(longestSequence + 1);
  }
}
