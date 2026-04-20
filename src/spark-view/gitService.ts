import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { simpleGit, SimpleGit } from 'simple-git';

/**
 * Git operations service — provides user identity for comment authoring.
 */
export class GitService {
  private git: SimpleGit | null = null;

  /**
   * Initialize git for the workspace
   */
  async initialize(): Promise<boolean> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      console.log('[SparkView] gitService.initialize: no workspace folder');
      return false;
    }

    // Try each workspace folder until we find a git repo
    for (const folder of folders) {
      console.log('[SparkView] gitService.initialize: trying folder =', folder.uri.fsPath);
      const candidate = simpleGit(folder.uri.fsPath);
      try {
        const isRepo = await candidate.checkIsRepo();
        if (isRepo) {
          console.log('[SparkView] gitService.initialize: found repo in', folder.uri.fsPath);
          this.git = candidate;
          return true;
        }
      } catch (err) {
        console.log('[SparkView] gitService.initialize: error checking', folder.uri.fsPath, err);
      }
    }

    console.log('[SparkView] gitService.initialize: no git repo found in any workspace folder');
    this.git = null;
    return false;
  }

  /**
   * Get git user display name (user.name), falling back to user.email
   */
  async getUserName(): Promise<string> {
    // Lazy-init if git wasn't ready at startup
    if (!this.git) {
      console.log('[SparkView] getUserName: git not initialized, retrying...');
      await this.initialize();
    }

    // Try via simpleGit first
    if (this.git) {
      try {
        const name = await this.git.raw(['config', 'user.name']);
        if (name.trim()) {
          return name.trim();
        }
      } catch {
        // fall through
      }
      try {
        const email = await this.git.raw(['config', 'user.email']);
        if (email.trim()) {
          return email.trim();
        }
      } catch {
        // fall through
      }
    }

    // Fallback: shell out to git directly (works even without a workspace folder)
    console.log('[SparkView] getUserName: falling back to execSync');
    try {
      const name = execSync('git config --global user.name', { encoding: 'utf8' }).trim();
      if (name) { return name; }
    } catch { /* ignore */ }
    try {
      const email = execSync('git config --global user.email', { encoding: 'utf8' }).trim();
      if (email) { return email; }
    } catch { /* ignore */ }

    return 'Unknown';
  }
}

export const gitService = new GitService();
