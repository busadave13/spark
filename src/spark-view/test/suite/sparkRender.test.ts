import * as assert from 'assert';
import * as path from 'path';
import {
  parseSparkHeader,
  updateSparkField,
  stripSparkBlockquote,
  inferSparkDocType,
  sparkDocTypeLabel,
  resolveInternalDocLink,
} from '../../utils/sparkRender';

suite('SPARK Utility Test Suite', () => {

  // ─── parseSparkHeader ───

  suite('parseSparkHeader', () => {
    const sampleDoc = [
      '<!-- SPARK -->',
      '',
      '# Product Requirements Document',
      '',
      '> **Version**: 1.0<br>',
      '> **Created**: 2026-04-01<br>',
      '> **Last Updated**: 2026-04-12<br>',
      '> **Owner**: Dave Harding<br>',
      '> **Project**: Mockery<br>',
      '> **Status**: Draft',
      '',
      '---',
    ].join('\n');

    test('parses all fields from blockquote header', () => {
      const result = parseSparkHeader(sampleDoc);
      assert.ok(result);
      assert.strictEqual(result.fields['Version'], '1.0');
      assert.strictEqual(result.fields['Created'], '2026-04-01');
      assert.strictEqual(result.fields['Last Updated'], '2026-04-12');
      assert.strictEqual(result.fields['Owner'], 'Dave Harding');
      assert.strictEqual(result.fields['Project'], 'Mockery');
      assert.strictEqual(result.fields['Status'], 'Draft');
    });

    test('returns correct blockquote line range', () => {
      const result = parseSparkHeader(sampleDoc);
      assert.ok(result);
      assert.strictEqual(result.blockquoteStartLine, 4);
      assert.strictEqual(result.blockquoteEndLine, 10);
    });

    test('returns null for document without blockquote metadata', () => {
      assert.strictEqual(parseSparkHeader('# Regular Doc\n\nContent'), null);
    });

    test('returns null when no blockquote exists', () => {
      const doc = '# Title\n\nJust content';
      assert.strictEqual(parseSparkHeader(doc), null);
    });

    test('parses blockquote even without SPARK marker', () => {
      const doc = [
        '# Title',
        '',
        '> **Version**: 2.0<br>',
        '> **Status**: Draft',
        '',
        '---',
      ].join('\n');
      const result = parseSparkHeader(doc);
      assert.ok(result);
      assert.strictEqual(result.fields['Version'], '2.0');
      assert.strictEqual(result.fields['Status'], 'Draft');
    });

    test('handles CRLF line endings', () => {
      const crlfDoc = sampleDoc.replace(/\n/g, '\r\n');
      const result = parseSparkHeader(crlfDoc);
      assert.ok(result);
      assert.strictEqual(result.fields['Version'], '1.0');
      assert.strictEqual(result.fields['Status'], 'Draft');
    });

    test('handles last line without <br>', () => {
      const result = parseSparkHeader(sampleDoc);
      assert.ok(result);
      assert.strictEqual(result.fields['Status'], 'Draft');
    });
  });

  // ─── updateSparkField ───

  suite('updateSparkField', () => {
    const sampleDoc = [
      '<!-- SPARK -->',
      '',
      '# Title',
      '',
      '> **Version**: 1.0<br>',
      '> **Last Updated**: 2026-04-12<br>',
      '> **Owner**: Dave<br>',
      '> **Status**: Draft',
      '',
      '---',
    ].join('\n');

    test('updates a field value', () => {
      const updated = updateSparkField(sampleDoc, 'Owner', 'Alice');
      assert.ok(updated.includes('> **Owner**: Alice<br>'));
    });

    test('auto-updates Last Updated when changing another field', () => {
      const updated = updateSparkField(sampleDoc, 'Owner', 'Alice');
      const today = new Date().toISOString().slice(0, 10);
      assert.ok(updated.includes(`> **Last Updated**: ${today}<br>`));
    });

    test('does not auto-update Last Updated when changing Last Updated itself', () => {
      const updated = updateSparkField(sampleDoc, 'Last Updated', '2099-01-01');
      assert.ok(updated.includes('> **Last Updated**: 2099-01-01<br>'));
    });

    test('returns original content when field not found', () => {
      const updated = updateSparkField(sampleDoc, 'NonExistent', 'value');
      assert.strictEqual(updated, sampleDoc);
    });

    test('handles CRLF input', () => {
      const crlfDoc = sampleDoc.replace(/\n/g, '\r\n');
      const updated = updateSparkField(crlfDoc, 'Version', '2.0');
      assert.ok(updated.includes('> **Version**: 2.0<br>'));
    });

    test('updates Status field', () => {
      const updated = updateSparkField(sampleDoc, 'Status', 'Approved');
      assert.ok(updated.includes('> **Status**: Approved'));
    });
  });

  // ─── stripSparkBlockquote ───

  suite('stripSparkBlockquote', () => {
    test('removes blockquote lines from document', () => {
      const doc = [
        '<!-- SPARK -->',
        '',
        '# Title',
        '',
        '> **Version**: 1.0<br>',
        '> **Status**: Draft',
        '',
        '---',
        'Content',
      ].join('\n');
      const header = parseSparkHeader(doc);
      assert.ok(header);
      const stripped = stripSparkBlockquote(doc, header);
      assert.ok(!stripped.includes('> **Version**'));
      assert.ok(!stripped.includes('> **Status**'));
      assert.ok(stripped.includes('# Title'));
      assert.ok(stripped.includes('Content'));
    });
  });

  // ─── inferSparkDocType ───

  suite('inferSparkDocType', () => {
    test('identifies PRD', () => {
      assert.strictEqual(inferSparkDocType(path.join('project', 'PRD.md')), 'PRD');
    });

    test('identifies Architecture', () => {
      assert.strictEqual(inferSparkDocType(path.join('project', 'ARCHITECTURE.md')), 'Architecture');
    });

    test('identifies ADR by directory', () => {
      assert.strictEqual(inferSparkDocType(path.join('adr', 'ADR-001.md')), 'ADR');
    });

    test('identifies Feature by directory', () => {
      assert.strictEqual(inferSparkDocType(path.join('feature', 'FEAT-001-login.md')), 'Feature');
    });

    test('returns Other for unknown type', () => {
      assert.strictEqual(inferSparkDocType(path.join('docs', 'random.md')), 'Other');
    });
  });

  // ─── sparkDocTypeLabel ───

  suite('sparkDocTypeLabel', () => {
    test('returns full label for PRD', () => {
      assert.strictEqual(sparkDocTypeLabel('PRD'), 'Product Requirements Document');
    });

    test('returns full label for Architecture', () => {
      assert.strictEqual(sparkDocTypeLabel('Architecture'), 'Architecture Document');
    });

    test('returns full label for ADR', () => {
      assert.strictEqual(sparkDocTypeLabel('ADR'), 'Architecture Decision Record');
    });

    test('returns full label for Feature', () => {
      assert.strictEqual(sparkDocTypeLabel('Feature'), 'Feature Spec');
    });

    test('returns empty string for Other', () => {
      assert.strictEqual(sparkDocTypeLabel('Other'), '');
    });
  });

  // ─── resolveInternalDocLink ───

  suite('resolveInternalDocLink', () => {
    const workspaceRoot = path.resolve(path.sep, 'workspace', 'project');
    const docsDir = path.join(workspaceRoot, '.docs');
    const currentDoc = path.join(docsDir, 'feature', 'FEAT-001-login.md');

    test('resolves a sibling .md file', () => {
      const result = resolveInternalDocLink(currentDoc, 'FEAT-002-auth.md', workspaceRoot);
      assert.ok(result);
      assert.strictEqual(result.filePath, path.join(docsDir, 'feature', 'FEAT-002-auth.md'));
      assert.strictEqual(result.fragment, null);
    });

    test('resolves a parent-relative path (../)', () => {
      const result = resolveInternalDocLink(currentDoc, '../PRD.md', workspaceRoot);
      assert.ok(result);
      assert.strictEqual(result.filePath, path.join(docsDir, 'PRD.md'));
      assert.strictEqual(result.fragment, null);
    });

    test('resolves with ./ prefix', () => {
      const result = resolveInternalDocLink(currentDoc, './FEAT-003.md', workspaceRoot);
      assert.ok(result);
      assert.strictEqual(result.filePath, path.join(docsDir, 'feature', 'FEAT-003.md'));
    });

    test('resolves path with fragment', () => {
      const result = resolveInternalDocLink(currentDoc, '../ARCHITECTURE.md#overview', workspaceRoot);
      assert.ok(result);
      assert.strictEqual(result.filePath, path.join(docsDir, 'ARCHITECTURE.md'));
      assert.strictEqual(result.fragment, 'overview');
    });

    test('returns null for empty href', () => {
      assert.strictEqual(resolveInternalDocLink(currentDoc, '', workspaceRoot), null);
    });

    test('returns null for anchor-only fragment', () => {
      assert.strictEqual(resolveInternalDocLink(currentDoc, '#section', workspaceRoot), null);
    });

    test('returns null for external http link', () => {
      assert.strictEqual(resolveInternalDocLink(currentDoc, 'https://example.com/doc.md', workspaceRoot), null);
    });

    test('returns null for mailto link', () => {
      assert.strictEqual(resolveInternalDocLink(currentDoc, 'mailto:test@example.com', workspaceRoot), null);
    });

    test('returns null for non-.md file', () => {
      assert.strictEqual(resolveInternalDocLink(currentDoc, '../image.png', workspaceRoot), null);
    });

    test('returns null for path escaping workspace root', () => {
      const result = resolveInternalDocLink(currentDoc, '../../../outside.md', workspaceRoot);
      assert.strictEqual(result, null);
    });

    test('handles URL-encoded paths', () => {
      const result = resolveInternalDocLink(currentDoc, 'My%20Document.md', workspaceRoot);
      assert.ok(result);
      assert.strictEqual(result.filePath, path.join(docsDir, 'feature', 'My Document.md'));
    });

    test('handles uppercase .MD extension', () => {
      const result = resolveInternalDocLink(currentDoc, '../README.MD', workspaceRoot);
      assert.ok(result);
      assert.strictEqual(result.filePath, path.join(docsDir, 'README.MD'));
    });

    test('returns null for data: protocol', () => {
      assert.strictEqual(resolveInternalDocLink(currentDoc, 'data:text/html,test', workspaceRoot), null);
    });

    test('returns null for vscode- protocol', () => {
      assert.strictEqual(resolveInternalDocLink(currentDoc, 'vscode-resource://file.md', workspaceRoot), null);
    });

    test('returns null for invalid URL encoding', () => {
      assert.strictEqual(resolveInternalDocLink(currentDoc, '%ZZbad.md', workspaceRoot), null);
    });

    test('fragment with empty file part returns null', () => {
      // "#frag" with no file part is anchor-only
      assert.strictEqual(resolveInternalDocLink(currentDoc, '#heading', workspaceRoot), null);
    });

    test('resolves doc at workspace root boundary', () => {
      const rootDoc = path.join(workspaceRoot, 'README.md');
      const result = resolveInternalDocLink(rootDoc, 'docs.md', workspaceRoot);
      assert.ok(result);
      assert.strictEqual(result.filePath, path.join(workspaceRoot, 'docs.md'));
    });
  });
});
