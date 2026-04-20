/**
 * Core types for the Markdown Review extension
 */

/** Surrounding context for fuzzy re-anchoring */
export interface TextContext {
  /** ~40 characters before the selected text */
  prefix: string;
  /** ~40 characters after the selected text */
  suffix: string;
}

/** Byte-offset range into raw markdown source */
export interface MarkdownRange {
  /** Start offset (inclusive) */
  startOffset: number;
  /** End offset (exclusive) */
  endOffset: number;
}

/** Anchor information for locating a comment within a document */
export interface CommentAnchor {
  /** The exact text the user selected */
  selectedText: string;
  /** Surrounding context for fuzzy re-anchoring when offsets drift */
  textContext: TextContext;
  /** Character offsets into the raw markdown source */
  markdownRange: MarkdownRange;
}

/** A single comment anchored to selected text in a document */
export interface Comment {
  /** Unique identifier (UUID) */
  id: string;
  /** Anchor information for locating this comment */
  anchor: CommentAnchor;
  /** Author name (from git config) */
  author: string;
  /** Comment body text (markdown supported) */
  body: string;
  /** ISO-8601 timestamp when created */
  created: string;
  /** ISO-8601 timestamp when last edited, or null */
  edited: string | null;
  /** Highlight color for the selected text (hex, e.g. "#FFD700") */
  color?: string;
}

/** The sidecar file schema for storing comments */
export interface SidecarFile {
  /** Name of the markdown document this file is for */
  doc: string;
  /** Schema version for future compatibility */
  version: '3.0';
  /** All comments for this document */
  comments: Comment[];
}

/** A parsed markdown section */
export interface MarkdownSection {
  /** The heading text */
  heading: string;
  /** Slug derived from heading */
  slug: string;
  /** Heading level (1-6) */
  level: number;
  /** Line number where section starts (0-indexed) */
  startLine: number;
  /** Line number where section ends (0-indexed, exclusive) */
  endLine: number;
  /** Content of the section (excluding heading) */
  content: string;
  /** Hash of first 200 chars of content */
  contentHash: string;
}
