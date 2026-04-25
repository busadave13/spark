import * as vscode from 'vscode';
import * as path from 'path';
import { sidecarManager } from './sidecarManager';
import { parseSparkHeader } from './utils/sparkRender';

/** Maps a SPARK document Status value to a VS Code ThemeColor for the file icon.
 *  Mirrors the preview pane's Status pill colors. Returns undefined for missing
 *  or unknown values so the icon falls back to the default markdown color. */
function getStatusIconColor(status: string | undefined): vscode.ThemeColor | undefined {
  if (!status) { return undefined; }
  switch (status.trim().toLowerCase()) {
    case 'draft': return new vscode.ThemeColor('charts.yellow');
    case 'approved': return new vscode.ThemeColor('charts.green');
    case 'implemented': return new vscode.ThemeColor('charts.purple');
    default: return undefined;
  }
}

export const SPARK_FOLDER = '.spark';
const SPARK_MARKDOWN_GLOB = `${SPARK_FOLDER}/**/*.md`;
const SPARK_SIDECAR_GLOB = `${SPARK_FOLDER}/**/*.comments.json`;

export interface SparkTreeNode {
  name: string;
  folders: SparkTreeNode[];
  files: string[];
}

function createSparkTreeNode(name: string): SparkTreeNode {
  return {
    name,
    folders: [],
    files: [],
  };
}

function normalizeSparkRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.startsWith(`${SPARK_FOLDER}/`)) {
    return normalized.slice(SPARK_FOLDER.length + 1);
  }

  return normalized;
}

export function buildSparkTree(relativePaths: string[]): SparkTreeNode {
  const root = createSparkTreeNode(SPARK_FOLDER);
  const folderIndex = new Map<string, SparkTreeNode>([['', root]]);

  for (const originalPath of relativePaths) {
    const normalizedPath = normalizeSparkRelativePath(originalPath);
    if (normalizedPath.length === 0) {
      continue;
    }

    const parts = normalizedPath.split('/').filter(part => part.length > 0);
    const fileName = parts.pop();
    if (!fileName) {
      continue;
    }

    let currentKey = '';
    let currentNode = root;

    for (const segment of parts) {
      const nextKey = currentKey ? `${currentKey}/${segment}` : segment;
      let nextNode = folderIndex.get(nextKey);
      if (!nextNode) {
        nextNode = createSparkTreeNode(segment);
        currentNode.folders.push(nextNode);
        folderIndex.set(nextKey, nextNode);
      }

      currentKey = nextKey;
      currentNode = nextNode;
    }

    if (!currentNode.files.includes(fileName)) {
      currentNode.files.push(fileName);
    }
  }

  sortSparkTree(root);
  return root;
}

function sortSparkTree(node: SparkTreeNode): void {
  node.folders.sort((left, right) => left.name.localeCompare(right.name));
  node.files.sort((left, right) => left.localeCompare(right));

  for (const folder of node.folders) {
    sortSparkTree(folder);
  }
}

/**
 * Represents a markdown file in the tree view.
 */
export class MarkdownFileItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly uri: vscode.Uri,
    public readonly commentCount: number,
    public readonly status?: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.resourceUri = uri;
    this.tooltip = uri.fsPath;
    this.contextValue = 'markdownFile';

    this.command = {
      command: 'sparkView.openPreview',
      title: 'Open Preview',
      arguments: [uri],
    };

    if (commentCount > 0) {
      this.description = `${commentCount} comment${commentCount > 1 ? 's' : ''}`;
    }

    const iconColor = getStatusIconColor(status);
    this.iconPath = iconColor
      ? new vscode.ThemeIcon('markdown', iconColor)
      : new vscode.ThemeIcon('markdown');
  }
}

/**
 * Represents a folder in the .spark tree view.
 */
export class FolderItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly folderPath: string,
    public readonly children: (MarkdownFileItem | FolderItem)[],
  ) {
    super(
      label,
      children.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None,
    );

    this.contextValue = 'folder';
    this.iconPath = vscode.ThemeIcon.Folder;
    this.resourceUri = vscode.Uri.file(folderPath);
    this.tooltip = folderPath;
  }
}

type TreeItem = MarkdownFileItem | FolderItem;

/**
 * Provides markdown files for the .spark sidebar tree view.
 */
export class MarkdownFilesProvider implements vscode.TreeDataProvider<TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly fileWatcher: vscode.FileSystemWatcher;
  private readonly sidecarWatcher: vscode.FileSystemWatcher;
  private readonly workspaceFolderWatcher: vscode.Disposable;
  private readonly saveDocumentWatcher: vscode.Disposable;
  private readonly changeDocumentWatcher: vscode.Disposable;
  private refreshTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(SPARK_MARKDOWN_GLOB);
    this.fileWatcher.onDidCreate(() => this.refresh());
    this.fileWatcher.onDidDelete(() => this.refresh());
    this.fileWatcher.onDidChange(() => this.refresh());

    this.sidecarWatcher = vscode.workspace.createFileSystemWatcher(SPARK_SIDECAR_GLOB);
    this.sidecarWatcher.onDidCreate(() => this.refresh());
    this.sidecarWatcher.onDidDelete(() => this.refresh());
    this.sidecarWatcher.onDidChange(() => this.refresh());

    this.workspaceFolderWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh());

    // Belt-and-suspenders: also refresh on document saves for .spark/ markdown
    // files. This catches saves made via VS Code's API that the FileSystemWatcher
    // may miss or delay (e.g., agent-driven edits, internal field updates).
    this.saveDocumentWatcher = vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.languageId === 'markdown' && doc.uri.fsPath.includes(`${path.sep}${SPARK_FOLDER}${path.sep}`)) {
        this.refresh();
      }
    });

    // Also refresh on in-memory content changes (e.g., workspace.applyEdit from
    // agents or the preview panel). The debounce in refresh() keeps this cheap.
    this.changeDocumentWatcher = vscode.workspace.onDidChangeTextDocument(e => {
      if (
        e.contentChanges.length > 0 &&
        e.document.languageId === 'markdown' &&
        e.document.uri.fsPath.includes(`${path.sep}${SPARK_FOLDER}${path.sep}`)
      ) {
        this.refresh();
      }
    });
  }

  refresh(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = setTimeout(() => {
      this.refreshTimeout = undefined;
      this._onDidChangeTreeData.fire();
    }, 300);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (element instanceof FolderItem) {
      return element.children;
    }

    if (element) {
      return [];
    }

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return [];
    }

    // Collect a root tree item per workspace folder that contains .spark
    const rootItems: FolderItem[] = [];
    for (const folder of folders) {
      const sparkRootPath = path.join(folder.uri.fsPath, SPARK_FOLDER);
      if (!(await this.sparkFolderExists(sparkRootPath))) {
        continue;
      }

      const pattern = new vscode.RelativePattern(folder, SPARK_MARKDOWN_GLOB);
      const mdFiles = await vscode.workspace.findFiles(pattern);
      if (mdFiles.length === 0) {
        continue;
      }

      const rootItem = await this.buildSparkRootTree(sparkRootPath, mdFiles);
      rootItems.push(rootItem);
    }

    // Single folder: preserve current UX (just show .spark root)
    if (rootItems.length <= 1) {
      return rootItems;
    }

    // Multiple folders: prefix label with workspace folder name
    for (const item of rootItems) {
      const wsFolder = folders.find(f => item.folderPath.startsWith(f.uri.fsPath));
      if (wsFolder) {
        (item as { label: string | vscode.TreeItemLabel }).label = `${wsFolder.name}/${SPARK_FOLDER}`;
      }
    }

    return rootItems;
  }

  private async sparkFolderExists(sparkRootPath: string): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(sparkRootPath));
      return (stat.type & vscode.FileType.Directory) === vscode.FileType.Directory;
    } catch {
      return false;
    }
  }

  private async buildSparkRootTree(sparkRootPath: string, files: vscode.Uri[]): Promise<FolderItem> {
    const relativePathToUri = new Map<string, vscode.Uri>();
    for (const file of files) {
      const relativePath = path.relative(sparkRootPath, file.fsPath).replace(/\\/g, '/');
      relativePathToUri.set(relativePath, file);
    }

    const sparkTree = buildSparkTree([...relativePathToUri.keys()]);
    return this.createFolderItem(sparkTree, sparkRootPath, relativePathToUri, []);
  }

  private async createFolderItem(
    node: SparkTreeNode,
    sparkRootPath: string,
    relativePathToUri: Map<string, vscode.Uri>,
    parentSegments: string[],
  ): Promise<FolderItem> {
    const currentSegments = node.name === SPARK_FOLDER
      ? parentSegments
      : [...parentSegments, node.name];

    const children: TreeItem[] = [];

    for (const folder of node.folders) {
      children.push(await this.createFolderItem(folder, sparkRootPath, relativePathToUri, currentSegments));
    }

    for (const fileName of node.files) {
      const relativePath = [...currentSegments, fileName].join('/');
      const uri = relativePathToUri.get(relativePath);
      if (!uri) {
        continue;
      }

      const commentCount = await this.getCommentCount(uri.fsPath);
      const status = await this.getDocumentStatus(uri);
      children.push(new MarkdownFileItem(fileName, uri, commentCount, status));
    }

    const folderPath = node.name === SPARK_FOLDER
      ? sparkRootPath
      : path.join(sparkRootPath, ...currentSegments);

    return new FolderItem(node.name, folderPath, children);
  }

  private async getCommentCount(filePath: string): Promise<number> {
    const sidecar = await sidecarManager.readSidecar(filePath);
    return sidecar?.comments.length ?? 0;
  }

  private async getDocumentStatus(uri: vscode.Uri): Promise<string | undefined> {
    try {
      // Prefer in-memory document content — it reflects workspace.applyEdit changes
      // immediately, whereas disk reads may lag behind after a save.
      const openDoc = vscode.workspace.textDocuments.find(
        d => d.uri.toString() === uri.toString(),
      );
      const text = openDoc
        ? openDoc.getText()
        : Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
      const header = parseSparkHeader(text);
      return header?.fields['Status'];
    } catch {
      return undefined;
    }
  }

  /**
   * Recursively collect all MarkdownFileItem URIs from a FolderItem,
   * optionally filtering out files by name pattern.
   */
  static collectFileUris(item: FolderItem, excludePattern?: RegExp): vscode.Uri[] {
    const uris: vscode.Uri[] = [];
    for (const child of item.children) {
      if (child instanceof FolderItem) {
        uris.push(...MarkdownFilesProvider.collectFileUris(child, excludePattern));
      } else if (child instanceof MarkdownFileItem) {
        if (excludePattern && excludePattern.test(child.label as string)) {
          continue;
        }
        uris.push(child.uri);
      }
    }
    return uris;
  }

  dispose(): void {
    if (this.refreshTimeout) { clearTimeout(this.refreshTimeout); }
    this.fileWatcher.dispose();
    this.sidecarWatcher.dispose();
    this.workspaceFolderWatcher.dispose();
    this.saveDocumentWatcher.dispose();
    this.changeDocumentWatcher.dispose();
    this._onDidChangeTreeData.dispose();
  }
}
