import * as vscode from 'vscode';
import { gitService } from './gitService';
import { PreviewPanel } from './previewPanel';
import { MarkdownFilesProvider, FolderItem } from './markdownFilesProvider';
import { updateSparkField } from './utils/sparkRender';

let markdownFilesProvider: MarkdownFilesProvider;

export async function activate(context: vscode.ExtensionContext) {
  console.log('[SparkView] Extension activating...');
  console.log('[SparkView] Workspace folders:', vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath));

  // Set extension URI for PreviewPanel to locate bundled resources (e.g., media/)
  PreviewPanel.setExtensionUri(context.extensionUri);

  // Create and register the .specs tree view
  markdownFilesProvider = new MarkdownFilesProvider();
  const treeView = vscode.window.createTreeView('sparkView.files', {
    treeDataProvider: markdownFilesProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);
  context.subscriptions.push({ dispose: () => markdownFilesProvider.dispose() });

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('sparkView.refreshFiles', () => markdownFilesProvider.refresh()),
    vscode.commands.registerCommand('sparkView.toggleCommentSidebar', () => PreviewPanel.toggleSidebar()),
    vscode.commands.registerCommand('sparkView.setFolderStatus', async (folderItem?: FolderItem) => {
      if (!(folderItem instanceof FolderItem)) {
        vscode.window.showWarningMessage('Please right-click a folder in the SparkView tree view.');
        return;
      }

      const BULK_STATUS_OPTIONS = ['Draft', 'Approved'];
      const chosen = await vscode.window.showQuickPick(BULK_STATUS_OPTIONS, {
        placeHolder: 'Set Status for all documents under this folder',
        title: `Set Status — ${folderItem.label}`,
      });
      if (!chosen) { return; }

      // Collect all markdown file URIs, excluding *.testplan.md
      const fileUris = MarkdownFilesProvider.collectFileUris(folderItem, /\.testplan\.md$/i);
      if (fileUris.length === 0) {
        vscode.window.showInformationMessage('No eligible documents found under this folder.');
        return;
      }

      let updatedCount = 0;
      for (const uri of fileUris) {
        try {
          // Use VS Code's document model when the file is open (preserves undo stack
          // and avoids overwriting unsaved in-editor changes).
          const openDoc = vscode.workspace.textDocuments.find(
            d => d.uri.toString() === uri.toString(),
          );

          let raw: string;
          if (openDoc) {
            raw = openDoc.getText();
          } else {
            const bytes = await vscode.workspace.fs.readFile(uri);
            raw = Buffer.from(bytes).toString('utf8');
          }

          const updated = updateSparkField(raw, 'Status', chosen);
          if (updated === raw) { continue; }

          if (openDoc) {
            const fullRange = new vscode.Range(
              openDoc.positionAt(0),
              openDoc.positionAt(raw.length),
            );
            const wsEdit = new vscode.WorkspaceEdit();
            wsEdit.replace(uri, fullRange, updated);
            await vscode.workspace.applyEdit(wsEdit);
            await openDoc.save();
          } else {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(updated, 'utf8'));
          }
          updatedCount++;
        } catch (err) {
          console.error(`[SparkView] Failed to update status for ${uri.fsPath}:`, err);
        }
      }

      markdownFilesProvider.refresh();
      vscode.window.showInformationMessage(
        `Updated Status to "${chosen}" for ${updatedCount} of ${fileUris.length} document(s).`,
      );
    }),
    vscode.commands.registerCommand('sparkView.openPreview', async (uri?: vscode.Uri) => {
      let document: vscode.TextDocument | undefined;
      if (uri) {
        // Invoked from explorer context menu or tree view — load document without opening an editor
        document = await vscode.workspace.openTextDocument(uri);
        // Close any editor tab the explorer may have opened BEFORE showing preview
        // to avoid active-editor-change events triggering a spurious re-render
        for (const tabGroup of vscode.window.tabGroups.all) {
          for (const tab of tabGroup.tabs) {
            const tabUri = (tab.input as { uri?: vscode.Uri })?.uri;
            if (tabUri && tabUri.toString() === uri.toString()) {
              await vscode.window.tabGroups.close(tab);
            }
          }
        }
        await PreviewPanel.show(document);
        return;
      } else {
        // Invoked from command palette or editor title
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'markdown') {
          document = editor.document;
        }
      }
      if (!document || document.languageId !== 'markdown') {
        vscode.window.showWarningMessage('Open a markdown file to preview with comments');
        return;
      }
      await PreviewPanel.show(document);
    })
  );

  // Initialize git service for user name detection
  try {
    await gitService.initialize();
  } catch (err) {
    console.error('[SparkView] Git initialization failed:', err);
  }
}

export function deactivate() {
  // Cleanup handled by disposables
}
