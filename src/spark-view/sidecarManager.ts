import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { SidecarFile, Comment } from './models/types';
import { v4 as uuidv4 } from 'uuid';

/** Origin tag so listeners can ignore their own writes. */
export type WriteOrigin = 'editor' | 'preview' | 'internal';

export interface SidecarChangeEvent {
  /** Absolute path of the markdown document the sidecar belongs to. */
  docPath: string;
  /** Who triggered the write. */
  origin: WriteOrigin;
}

/**
 * Manages reading and writing of sidecar .comments.json files.
 *
 * Schema version 3.0: each entry in `comments` is a flat single-author comment
 * (no reply threads, no resolved/stale status). Older 2.0 files are rejected.
 */
export class SidecarManager {
  /** True while we are writing a sidecar file ourselves (to suppress watcher reloads). */
  writing = false;

  private readonly _onDidChange = new vscode.EventEmitter<SidecarChangeEvent>();
  /** Fired after every successful sidecar write. */
  public readonly onDidChange: vscode.Event<SidecarChangeEvent> = this._onDidChange.event;

  /**
   * Get the sidecar file path for a markdown document
   */
  getSidecarPath(docPath: string): string {
    const dir = path.dirname(docPath);
    const base = path.basename(docPath, '.md');
    return path.join(dir, `${base}.comments.json`);
  }

  /**
   * Check if a sidecar file exists
   */
  sidecarExists(docPath: string): boolean {
    return fs.existsSync(this.getSidecarPath(docPath));
  }

  /**
   * Read and parse a sidecar file
   */
  async readSidecar(docPath: string): Promise<SidecarFile | null> {
    const sidecarPath = this.getSidecarPath(docPath);

    if (!fs.existsSync(sidecarPath)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(sidecarPath, 'utf-8');
      const data = JSON.parse(content) as SidecarFile;
      return this.validateSidecar(data) ? data : null;
    } catch (error) {
      console.error(`Failed to read sidecar file: ${sidecarPath}`, error);
      return null;
    }
  }

  /**
   * Write a sidecar file atomically.
   * @param origin  Who is triggering the write (so listeners can skip their own changes).
   */
  async writeSidecar(docPath: string, sidecar: SidecarFile, origin: WriteOrigin = 'internal'): Promise<void> {
    // If all comments have been removed, delete the sidecar file instead of writing an empty one
    if (sidecar.comments.length === 0) {
      await this.deleteSidecar(docPath);
      this._onDidChange.fire({ docPath, origin });
      return;
    }

    const sidecarPath = this.getSidecarPath(docPath);
    const tempPath = `${sidecarPath}.tmp`;

    this.writing = true;
    try {
      const content = JSON.stringify(sidecar, null, 2);
      await fs.promises.writeFile(tempPath, content, 'utf-8');
      await fs.promises.rename(tempPath, sidecarPath);
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath);
      }
      throw error;
    } finally {
      setTimeout(() => { this.writing = false; }, 500);
    }

    this._onDidChange.fire({ docPath, origin });
  }

  /**
   * Delete the sidecar file for a markdown document if it exists.
   */
  async deleteSidecar(docPath: string): Promise<void> {
    const sidecarPath = this.getSidecarPath(docPath);
    if (fs.existsSync(sidecarPath)) {
      await fs.promises.unlink(sidecarPath);
    }
  }

  /**
   * Create a new empty sidecar file
   */
  createEmptySidecar(docName: string): SidecarFile {
    return {
      doc: docName,
      version: '3.0',
      comments: [],
    };
  }

  /**
   * Add a new comment to a sidecar. Assigns a UUID if the caller didn't pass one.
   */
  addComment(sidecar: SidecarFile, comment: Omit<Comment, 'id'>): Comment {
    const newComment: Comment = {
      ...comment,
      id: uuidv4(),
    };
    sidecar.comments.push(newComment);
    return newComment;
  }

  /**
   * Delete a comment from the sidecar by id. Returns true if something was removed.
   */
  deleteComment(sidecar: SidecarFile, commentId: string): boolean {
    const index = sidecar.comments.findIndex(c => c.id === commentId);
    if (index === -1) {
      return false;
    }
    sidecar.comments.splice(index, 1);
    return true;
  }

  /**
   * Edit the body of a comment. Sets the `edited` timestamp. Returns the updated
   * comment or null if no such id exists.
   */
  editComment(sidecar: SidecarFile, commentId: string, newBody: string): Comment | null {
    const comment = sidecar.comments.find(c => c.id === commentId);
    if (!comment) { return null; }
    comment.body = newBody;
    comment.edited = new Date().toISOString();
    return comment;
  }

  /**
   * Validate sidecar file structure. Only accepts schema v3.0.
   */
  private validateSidecar(data: unknown): data is SidecarFile {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const sidecar = data as Record<string, unknown>;

    if (typeof sidecar.doc !== 'string') {
      return false;
    }
    if (sidecar.version !== '3.0') {
      return false;
    }
    if (!Array.isArray(sidecar.comments)) {
      return false;
    }

    return true;
  }
}

export const sidecarManager = new SidecarManager();
