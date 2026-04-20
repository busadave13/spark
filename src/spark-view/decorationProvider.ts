import * as vscode from 'vscode';
import * as path from 'path';
import { sidecarManager } from './sidecarManager';
import { anchorEngine } from './anchorEngine';

/**
 * Provides gutter decorations showing comment bubbles
 */
export class DecorationProvider implements vscode.Disposable {
  private openDecoration: vscode.TextEditorDecorationType;
  private disposables: vscode.Disposable[] = [];

  constructor(extensionPath: string) {
    this.openDecoration = vscode.window.createTextEditorDecorationType({
      gutterIconPath: path.join(extensionPath, 'media', 'comment-bubble.svg'),
      gutterIconSize: 'contain',
    });

    this.disposables.push(this.openDecoration);
  }

  /**
   * Update decorations for a document
   */
  async updateDecorations(editor: vscode.TextEditor): Promise<void> {
    const document = editor.document;

    if (document.languageId !== 'markdown') {
      this.clearDecorations(editor);
      return;
    }

    if (!this.isMarkdownFile(document)) {
      this.clearDecorations(editor);
      return;
    }

    const sidecar = await sidecarManager.readSidecar(document.uri.fsPath);
    if (!sidecar || sidecar.comments.length === 0) {
      this.clearDecorations(editor);
      return;
    }

    const rawText = document.getText();
    const openRanges: vscode.DecorationOptions[] = [];

    for (const comment of sidecar.comments) {
      // Re-anchor to find current position
      const anchoredRange = anchorEngine.anchorComment(comment.anchor, rawText);
      if (!anchoredRange) {
        continue; // Can't locate this comment — skip decoration
      }

      const startPos = document.positionAt(anchoredRange.startOffset);
      const endPos = document.positionAt(anchoredRange.endOffset);
      const range = new vscode.Range(startPos, endPos);

      const preview = comment.body.length > 50
        ? comment.body.substring(0, 50) + '...'
        : comment.body;
      const selectedText = comment.anchor.selectedText.length > 30
        ? comment.anchor.selectedText.substring(0, 30) + '...'
        : comment.anchor.selectedText;

      openRanges.push({
        range,
        hoverMessage: new vscode.MarkdownString(
          `**Comment** on _"${selectedText}"_\n\n${preview}`,
        ),
      });
    }

    editor.setDecorations(this.openDecoration, openRanges);
  }

  /**
   * Clear all decorations from an editor
   */
  clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.openDecoration, []);
  }

  /**
   * Check if document is a markdown file eligible for decorations.
   * Any .md file in the workspace can receive comments (Issue #2).
   */
  private isMarkdownFile(document: vscode.TextDocument): boolean {
    return document.languageId === 'markdown';
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
