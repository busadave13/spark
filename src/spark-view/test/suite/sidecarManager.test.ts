import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SidecarManager } from '../../sidecarManager';
import type { SidecarFile, Comment } from '../../models/types';

/** Helper: create a fresh SidecarManager instance for test isolation. */
function makeSidecar(): SidecarManager {
  return new SidecarManager();
}

/** Helper: build a minimal valid SidecarFile */
function emptySidecar(doc = 'test.md'): SidecarFile {
  return { doc, version: '3.0', comments: [] };
}

/** Helper: build a text-selection anchor */
function makeAnchor(selectedText = 'important text', startOffset = 50, endOffset = 64) {
  return {
    selectedText,
    textContext: { prefix: 'some prefix context here...', suffix: 'some suffix context here...' },
    markdownRange: { startOffset, endOffset },
  };
}

/** Helper: build a comment stub (Omit<Comment, 'id'>) */
function commentStub(overrides: Partial<Omit<Comment, 'id'>> = {}): Omit<Comment, 'id'> {
  return {
    anchor: makeAnchor(),
    author: 'alice',
    body: 'Looks good!',
    created: new Date().toISOString(),
    edited: null,
    ...overrides,
  };
}

suite('SidecarManager Test Suite', () => {
  // ── Path helpers ──────────────────────────────────────────────────

  test('getSidecarPath returns .comments.json sibling', () => {
    const mgr = makeSidecar();
    const result = mgr.getSidecarPath('/repo/design/doc.md');
    assert.strictEqual(result, path.join('/repo/design', 'doc.comments.json'));
  });

  test('getSidecarPath strips only .md extension', () => {
    const mgr = makeSidecar();
    const result = mgr.getSidecarPath('/repo/notes.md');
    assert.strictEqual(result, path.join('/repo', 'notes.comments.json'));
  });

  test('getSidecarPath handles nested directories', () => {
    const mgr = makeSidecar();
    const result = mgr.getSidecarPath('/a/b/c/deep.md');
    assert.strictEqual(result, path.join('/a/b/c', 'deep.comments.json'));
  });

  // ── createEmptySidecar ────────────────────────────────────────────

  test('createEmptySidecar returns valid v3.0 structure', () => {
    const mgr = makeSidecar();
    const sc = mgr.createEmptySidecar('design.md');
    assert.strictEqual(sc.doc, 'design.md');
    assert.strictEqual(sc.version, '3.0');
    assert.ok(Array.isArray(sc.comments));
    assert.strictEqual(sc.comments.length, 0);
  });

  // ── addComment ────────────────────────────────────────────────────

  test('addComment assigns a UUID and appends to comments', () => {
    const mgr = makeSidecar();
    const sc = emptySidecar();
    const added = mgr.addComment(sc, commentStub());

    assert.strictEqual(sc.comments.length, 1);
    assert.ok(added.id, 'comment must receive an id');
    assert.strictEqual(added.anchor.selectedText, 'important text');
    assert.strictEqual(added.author, 'alice');
    assert.strictEqual(added.body, 'Looks good!');
  });

  test('addComment generates unique IDs for multiple comments', () => {
    const mgr = makeSidecar();
    const sc = emptySidecar();
    const c1 = mgr.addComment(sc, commentStub());
    const c2 = mgr.addComment(sc, commentStub({ anchor: makeAnchor('api endpoint', 100, 112) }));

    assert.strictEqual(sc.comments.length, 2);
    assert.notStrictEqual(c1.id, c2.id);
  });

  test('addComment stores the comment exactly in sidecar.comments', () => {
    const mgr = makeSidecar();
    const sc = emptySidecar();
    const created = mgr.addComment(sc, commentStub());

    assert.strictEqual(sc.comments[0].id, created.id);
    assert.strictEqual(sc.comments[0], created);
  });

  // ── deleteComment ─────────────────────────────────────────────────

  test('deleteComment removes the comment by id', () => {
    const mgr = makeSidecar();
    const sc = emptySidecar();
    const created = mgr.addComment(sc, commentStub());

    const deleted = mgr.deleteComment(sc, created.id);
    assert.strictEqual(deleted, true);
    assert.strictEqual(sc.comments.length, 0);
  });

  test('deleteComment returns false for unknown id', () => {
    const mgr = makeSidecar();
    const sc = emptySidecar();

    assert.strictEqual(mgr.deleteComment(sc, 'no-such-id'), false);
  });

  test('deleteComment leaves other comments intact', () => {
    const mgr = makeSidecar();
    const sc = emptySidecar();
    const c1 = mgr.addComment(sc, commentStub({ body: 'first' }));
    const c2 = mgr.addComment(sc, commentStub({ body: 'second' }));

    mgr.deleteComment(sc, c1.id);
    assert.strictEqual(sc.comments.length, 1);
    assert.strictEqual(sc.comments[0].id, c2.id);
  });

  // ── editComment ───────────────────────────────────────────────────

  test('editComment updates body and sets edited timestamp', () => {
    const mgr = makeSidecar();
    const sc = emptySidecar();
    const created = mgr.addComment(sc, commentStub());
    assert.strictEqual(created.edited, null);

    const updated = mgr.editComment(sc, created.id, 'Updated body');
    assert.ok(updated);
    assert.strictEqual(updated!.body, 'Updated body');
    assert.ok(updated!.edited, 'edited should be set');
    // Same object reference — mutation-in-place
    assert.strictEqual(sc.comments[0].body, 'Updated body');
  });

  test('editComment returns null for unknown id', () => {
    const mgr = makeSidecar();
    const sc = emptySidecar();

    assert.strictEqual(mgr.editComment(sc, 'no-such-comment', 'x'), null);
  });

  // ── File I/O round-trip ──────────────────────────────────────────

  test('writeSidecar and readSidecar round-trip correctly', async () => {
    const mgr = makeSidecar();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    const docPath = path.join(tmpDir, 'design.md');
    fs.writeFileSync(docPath, '# Test', 'utf-8');

    const sc = emptySidecar('design.md');
    mgr.addComment(sc, commentStub());

    await mgr.writeSidecar(docPath, sc);

    const loaded = await mgr.readSidecar(docPath);
    assert.ok(loaded);
    assert.strictEqual(loaded!.doc, 'design.md');
    assert.strictEqual(loaded!.version, '3.0');
    assert.strictEqual(loaded!.comments.length, 1);
    assert.strictEqual(loaded!.comments[0].anchor.selectedText, 'important text');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('readSidecar returns null when file does not exist', async () => {
    const mgr = makeSidecar();
    const result = await mgr.readSidecar('/nonexistent/path/doc.md');
    assert.strictEqual(result, null);
  });

  test('readSidecar returns null for malformed JSON', async () => {
    const mgr = makeSidecar();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    const docPath = path.join(tmpDir, 'doc.md');
    const sidecarPath = mgr.getSidecarPath(docPath);

    fs.writeFileSync(sidecarPath, '{ this is not valid json }', 'utf-8');

    const result = await mgr.readSidecar(docPath);
    assert.strictEqual(result, null);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('readSidecar returns null for invalid schema (missing doc)', async () => {
    const mgr = makeSidecar();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    const docPath = path.join(tmpDir, 'doc.md');
    const sidecarPath = mgr.getSidecarPath(docPath);

    fs.writeFileSync(sidecarPath, JSON.stringify({ version: '3.0', comments: [] }), 'utf-8');

    const result = await mgr.readSidecar(docPath);
    assert.strictEqual(result, null);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('readSidecar rejects legacy 2.0 schema', async () => {
    const mgr = makeSidecar();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    const docPath = path.join(tmpDir, 'doc.md');
    const sidecarPath = mgr.getSidecarPath(docPath);

    fs.writeFileSync(sidecarPath, JSON.stringify({ doc: 'doc.md', version: '2.0', comments: [] }), 'utf-8');

    const result = await mgr.readSidecar(docPath);
    assert.strictEqual(result, null, '2.0 files are not migrated — breaking change');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('readSidecar returns null when comments is not an array', async () => {
    const mgr = makeSidecar();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    const docPath = path.join(tmpDir, 'doc.md');
    const sidecarPath = mgr.getSidecarPath(docPath);

    fs.writeFileSync(sidecarPath, JSON.stringify({ doc: 'doc.md', version: '3.0', comments: 'not-array' }), 'utf-8');

    const result = await mgr.readSidecar(docPath);
    assert.strictEqual(result, null);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('sidecarExists returns correct boolean', async () => {
    const mgr = makeSidecar();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    const docPath = path.join(tmpDir, 'design.md');

    assert.strictEqual(mgr.sidecarExists(docPath), false);

    const sc = emptySidecar('design.md');
    mgr.addComment(sc, commentStub());
    await mgr.writeSidecar(docPath, sc);

    assert.strictEqual(mgr.sidecarExists(docPath), true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── onDidChange event ────────────────────────────────────────────

  test('writeSidecar fires onDidChange with correct origin', async () => {
    const mgr = makeSidecar();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    const docPath = path.join(tmpDir, 'design.md');
    const sc = emptySidecar('design.md');

    let firedDocPath: string | null = null;
    let firedOrigin: string | null = null;
    mgr.onDidChange((e) => {
      firedDocPath = e.docPath;
      firedOrigin = e.origin;
    });

    await mgr.writeSidecar(docPath, sc, 'editor');

    assert.ok(firedDocPath, 'onDidChange should have fired');
    assert.strictEqual(firedDocPath, docPath);
    assert.strictEqual(firedOrigin, 'editor');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writeSidecar defaults origin to internal', async () => {
    const mgr = makeSidecar();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    const docPath = path.join(tmpDir, 'design.md');
    const sc = emptySidecar('design.md');

    let firedOrigin: string | null = null;
    mgr.onDidChange((e) => {
      firedOrigin = e.origin;
    });

    await mgr.writeSidecar(docPath, sc);

    assert.strictEqual(firedOrigin, 'internal');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── deleteSidecar ──────────────────────────────────────────────────

  test('deleteSidecar removes existing sidecar file', async () => {
    const mgr = makeSidecar();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    const docPath = path.join(tmpDir, 'doc.md');

    const sc = emptySidecar('doc.md');
    mgr.addComment(sc, commentStub());
    await mgr.writeSidecar(docPath, sc);
    assert.strictEqual(mgr.sidecarExists(docPath), true);

    await mgr.deleteSidecar(docPath);
    assert.strictEqual(mgr.sidecarExists(docPath), false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('deleteSidecar is a no-op when file does not exist', async () => {
    const mgr = makeSidecar();
    await mgr.deleteSidecar(path.join(os.tmpdir(), 'nonexistent-doc.md'));
  });

  // ── writeSidecar auto-delete on empty comments ──────────────────────

  test('writeSidecar deletes sidecar file when comments array is empty', async () => {
    const mgr = makeSidecar();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    const docPath = path.join(tmpDir, 'doc.md');

    const sc = emptySidecar('doc.md');
    mgr.addComment(sc, commentStub());
    await mgr.writeSidecar(docPath, sc);
    assert.strictEqual(mgr.sidecarExists(docPath), true);

    sc.comments = [];
    await mgr.writeSidecar(docPath, sc, 'preview');
    assert.strictEqual(mgr.sidecarExists(docPath), false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writeSidecar fires onDidChange when deleting empty sidecar', async () => {
    const mgr = makeSidecar();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    const docPath = path.join(tmpDir, 'doc.md');

    const sc = emptySidecar('doc.md');
    mgr.addComment(sc, commentStub());
    await mgr.writeSidecar(docPath, sc);

    let firedOrigin: string | null = null;
    let firedDocPath: string | null = null;
    mgr.onDidChange((e) => {
      firedOrigin = e.origin;
      firedDocPath = e.docPath;
    });

    sc.comments = [];
    await mgr.writeSidecar(docPath, sc, 'preview');

    assert.strictEqual(firedOrigin, 'preview');
    assert.strictEqual(firedDocPath, docPath);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('deleteComment + writeSidecar deletes file when last comment removed', async () => {
    const mgr = makeSidecar();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    const docPath = path.join(tmpDir, 'doc.md');

    const sc = emptySidecar('doc.md');
    const created = mgr.addComment(sc, commentStub());
    await mgr.writeSidecar(docPath, sc);
    assert.strictEqual(mgr.sidecarExists(docPath), true);

    mgr.deleteComment(sc, created.id);
    await mgr.writeSidecar(docPath, sc, 'preview');
    assert.strictEqual(mgr.sidecarExists(docPath), false);

    const result = await mgr.readSidecar(docPath);
    assert.strictEqual(result, null);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('full round-trip: add comment, write, read, edit, write, read', async () => {
    const mgr = makeSidecar();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-test-'));
    const docPath = path.join(tmpDir, 'roundtrip.md');
    fs.writeFileSync(docPath, '# Test', 'utf-8');

    // Step 1: Create comment and write (simulates creating a comment)
    const sc1 = emptySidecar('roundtrip.md');
    const created = mgr.addComment(sc1, commentStub());
    await mgr.writeSidecar(docPath, sc1, 'editor');

    // Step 2: Read back
    const sc2 = await mgr.readSidecar(docPath);
    assert.ok(sc2);
    assert.strictEqual(sc2!.comments.length, 1);
    assert.strictEqual(sc2!.comments[0].id, created.id);

    // Step 3: Edit using the id from the file
    const edited = mgr.editComment(sc2!, created.id, 'Edited by preview');
    assert.ok(edited);
    await mgr.writeSidecar(docPath, sc2!, 'preview');

    // Step 4: Read back again
    const sc3 = await mgr.readSidecar(docPath);
    assert.ok(sc3);
    assert.strictEqual(sc3!.comments[0].body, 'Edited by preview');
    assert.ok(sc3!.comments[0].edited, 'edited timestamp should persist');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
