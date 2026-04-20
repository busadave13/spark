import * as assert from 'assert';
import { AnchorEngine } from '../../anchorEngine';
import type { Comment, CommentAnchor } from '../../models/types';

const SAMPLE_MD = `# Introduction

This is the introduction paragraph with some important text that we might want to comment on.

## API Endpoints

GET /users returns all users. POST /users creates a new user.

## Authentication

Authentication is handled via JWT tokens. Users must provide a valid token.`;

/** Helper: build a CommentAnchor for the given text within SAMPLE_MD */
function anchorFor(text: string, source = SAMPLE_MD): CommentAnchor {
  const engine = new AnchorEngine();
  const start = source.indexOf(text);
  if (start === -1) { throw new Error(`Text "${text}" not found in source`); }
  return engine.createAnchor(text, start, start + text.length, source);
}

/** Helper: build a Comment */
function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: overrides.id ?? 'comment-1',
    anchor: overrides.anchor ?? anchorFor('important text'),
    author: overrides.author ?? 'alice',
    body: overrides.body ?? 'Looks good',
    created: overrides.created ?? new Date().toISOString(),
    edited: overrides.edited ?? null,
    ...overrides,
  };
}

suite('AnchorEngine Test Suite', () => {

  // ── extractContext ────────────────────────────────────────────────

  test('extractContext returns prefix and suffix around selection', () => {
    const engine = new AnchorEngine();
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';
    const ctx = engine.extractContext(text, 10, 15);
    assert.strictEqual(ctx.prefix, text.slice(0, 10));
    assert.strictEqual(ctx.suffix, text.slice(15, 55));
  });

  test('extractContext handles start-of-document selection', () => {
    const engine = new AnchorEngine();
    const ctx = engine.extractContext('Hello world', 0, 5);
    assert.strictEqual(ctx.prefix, '');
    assert.strictEqual(ctx.suffix, ' world');
  });

  test('extractContext handles end-of-document selection', () => {
    const engine = new AnchorEngine();
    const ctx = engine.extractContext('Hello world', 6, 11);
    assert.strictEqual(ctx.suffix, '');
    assert.ok(ctx.prefix.length > 0);
  });

  // ── createAnchor ─────────────────────────────────────────────────

  test('createAnchor returns correct selectedText and range', () => {
    const engine = new AnchorEngine();
    const source = 'The quick brown fox jumps over the lazy dog.';
    const anchor = engine.createAnchor('brown fox', 10, 19, source);

    assert.strictEqual(anchor.selectedText, 'brown fox');
    assert.strictEqual(anchor.markdownRange.startOffset, 10);
    assert.strictEqual(anchor.markdownRange.endOffset, 19);
    assert.ok(anchor.textContext.prefix.length > 0);
    assert.ok(anchor.textContext.suffix.length > 0);
  });

  test('createAnchor captures context from markdown source', () => {
    const anchor = anchorFor('important text');
    assert.strictEqual(anchor.selectedText, 'important text');
    assert.ok(anchor.textContext.prefix.length > 0, 'should have prefix context');
    assert.ok(anchor.textContext.suffix.length > 0, 'should have suffix context');
  });

  // ── anchorComment — Strategy 1: exact offset match ───────────────

  test('anchorComment finds text at exact original offsets', () => {
    const engine = new AnchorEngine();
    const anchor = anchorFor('GET /users');
    const result = engine.anchorComment(anchor, SAMPLE_MD);

    assert.ok(result);
    assert.strictEqual(SAMPLE_MD.slice(result!.startOffset, result!.endOffset), 'GET /users');
  });

  // ── anchorComment — Strategy 2: nearby window search ─────────────

  test('anchorComment finds text when offsets shift slightly', () => {
    const engine = new AnchorEngine();
    const anchor = anchorFor('JWT tokens');

    const edited = SAMPLE_MD.replace('# Introduction', '# Introduction\n\nNew paragraph added here.');
    const result = engine.anchorComment(anchor, edited);

    assert.ok(result, 'Should find text in nearby window');
    assert.strictEqual(edited.slice(result!.startOffset, result!.endOffset), 'JWT tokens');
  });

  // ── anchorComment — Strategy 3: context search ───────────────────

  test('anchorComment finds text via context when far from original position', () => {
    const engine = new AnchorEngine();
    const anchor = anchorFor('JWT tokens');

    const farAway = 'X'.repeat(2000) + '\n\nAuthentication is handled via JWT tokens. Users must provide a valid token.';
    const result = engine.anchorComment(anchor, farAway);

    assert.ok(result, 'Should find text via context concatenation or partial context');
    assert.strictEqual(farAway.slice(result!.startOffset, result!.endOffset), 'JWT tokens');
  });

  // ── anchorComment — Strategy 5: global search ────────────────────

  test('anchorComment falls back to global search when context is gone', () => {
    const engine = new AnchorEngine();
    const anchor: CommentAnchor = {
      selectedText: 'unique phrase xyz',
      textContext: { prefix: 'completely different prefix', suffix: 'completely different suffix' },
      markdownRange: { startOffset: 9999, endOffset: 10016 },
    };

    const source = 'Some content. Then unique phrase xyz appears here.';
    const result = engine.anchorComment(anchor, source);

    assert.ok(result, 'Should find via global search');
    assert.strictEqual(source.slice(result!.startOffset, result!.endOffset), 'unique phrase xyz');
  });

  // ── anchorComment — orphaned ─────────────────────────────────────

  test('anchorComment returns null when text is completely gone', () => {
    const engine = new AnchorEngine();
    const anchor: CommentAnchor = {
      selectedText: 'this text does not exist anywhere',
      textContext: { prefix: 'nope', suffix: 'nope' },
      markdownRange: { startOffset: 0, endOffset: 32 },
    };

    const result = engine.anchorComment(anchor, SAMPLE_MD);
    assert.strictEqual(result, null);
  });

  // ── reanchorComments ─────────────────────────────────────────────

  test('reanchorComments reports no orphans when all comments match', () => {
    const engine = new AnchorEngine();
    const c = comment({ anchor: anchorFor('important text') });

    const { orphaned, anchorsMoved } = engine.reanchorComments(SAMPLE_MD, [c]);
    assert.strictEqual(orphaned.length, 0);
    assert.strictEqual(anchorsMoved, false);
  });

  test('reanchorComments reports orphaned comment when text is removed', () => {
    const engine = new AnchorEngine();
    const c = comment({
      anchor: {
        selectedText: 'nonexistent text that is not in the document',
        textContext: { prefix: 'nope', suffix: 'nope' },
        markdownRange: { startOffset: 0, endOffset: 44 },
      },
    });

    const { orphaned } = engine.reanchorComments(SAMPLE_MD, [c]);
    assert.strictEqual(orphaned.length, 1);
    assert.strictEqual(orphaned[0].id, c.id);
  });

  test('reanchorComments updates anchor offsets when text moves', () => {
    const engine = new AnchorEngine();
    const c = comment({ anchor: anchorFor('JWT tokens') });
    const originalStart = c.anchor.markdownRange.startOffset;

    const edited = SAMPLE_MD.replace('# Introduction', '# Introduction\n\nExtra paragraph.');
    const { orphaned, anchorsMoved } = engine.reanchorComments(edited, [c]);

    assert.strictEqual(orphaned.length, 0);
    assert.strictEqual(anchorsMoved, true);
    assert.notStrictEqual(c.anchor.markdownRange.startOffset, originalStart);
    assert.strictEqual(edited.slice(c.anchor.markdownRange.startOffset, c.anchor.markdownRange.endOffset), 'JWT tokens');
  });

  test('reanchorComments handles multiple comments with mixed locatability', () => {
    const engine = new AnchorEngine();

    const comments = [
      comment({ id: 'c1', anchor: anchorFor('GET /users') }),
      comment({
        id: 'c2',
        anchor: {
          selectedText: 'gone for good phrase',
          textContext: { prefix: 'nope', suffix: 'nope' },
          markdownRange: { startOffset: 0, endOffset: 20 },
        },
      }),
      comment({ id: 'c3', anchor: anchorFor('JWT tokens') }),
    ];

    const { orphaned } = engine.reanchorComments(SAMPLE_MD, comments);
    assert.strictEqual(orphaned.length, 1);
    assert.strictEqual(orphaned[0].id, 'c2');
  });

  test('reanchorComments does not mutate anchors of orphaned comments', () => {
    const engine = new AnchorEngine();
    const originalAnchor: CommentAnchor = {
      selectedText: 'never-ever-present',
      textContext: { prefix: 'p', suffix: 's' },
      markdownRange: { startOffset: 42, endOffset: 60 },
    };
    const c = comment({ anchor: { ...originalAnchor, textContext: { ...originalAnchor.textContext }, markdownRange: { ...originalAnchor.markdownRange } } });

    engine.reanchorComments(SAMPLE_MD, [c]);
    assert.strictEqual(c.anchor.selectedText, originalAnchor.selectedText);
    assert.strictEqual(c.anchor.markdownRange.startOffset, originalAnchor.markdownRange.startOffset);
    assert.strictEqual(c.anchor.markdownRange.endOffset, originalAnchor.markdownRange.endOffset);
  });

  // ── Duplicate text handling ──────────────────────────────────────

  test('anchorComment picks nearest match for duplicate text in window search', () => {
    const engine = new AnchorEngine();
    const source = 'AAA the BBB CCC the DDD EEE the FFF';
    const anchor = engine.createAnchor('the', 16, 19, source);

    const edited = 'XX AAA the BBB CCC the DDD EEE the FFF';
    const result = engine.anchorComment(anchor, edited);
    assert.ok(result);
    assert.strictEqual(edited.slice(result!.startOffset, result!.endOffset), 'the');
    assert.ok(result!.startOffset > 10, `Expected nearest match, got offset ${result!.startOffset}`);
  });

  // ── CRLF normalization ───────────────────────────────────────────

  test('anchorComment works with CRLF line endings', () => {
    const engine = new AnchorEngine();
    const lfSource = 'Line one\nLine two\nLine three';
    const anchor = engine.createAnchor('Line two', 9, 17, lfSource);

    const crlfSource = 'Line one\r\nLine two\r\nLine three';
    const result = engine.anchorComment(anchor, crlfSource);
    assert.ok(result, 'Should find text despite CRLF');
    assert.strictEqual(crlfSource.slice(result!.startOffset, result!.endOffset), 'Line two');
  });
});
