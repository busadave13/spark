import * as assert from 'assert';
import { buildSparkTree, SPARK_FOLDER } from '../../markdownFilesProvider';

suite('buildSparkTree Test Suite', () => {
  test('returns a .specs root node for empty input', () => {
    const tree = buildSparkTree([]);

    assert.strictEqual(tree.name, SPARK_FOLDER);
    assert.deepStrictEqual(tree.folders, []);
    assert.deepStrictEqual(tree.files, []);
  });

  test('builds a nested folder tree from relative paths', () => {
    const tree = buildSparkTree([
      'Mockery/PRD.md',
      'Mockery/feature/FEAT-001.md',
      'Mockery/adr/ADR-0001.md',
      'Weather/SPEC.md',
    ]);

    assert.strictEqual(tree.folders.length, 2);
    assert.strictEqual(tree.folders[0].name, 'Mockery');
    assert.strictEqual(tree.folders[1].name, 'Weather');

    const mockery = tree.folders[0];
    assert.deepStrictEqual(mockery.files, ['PRD.md']);
    assert.deepStrictEqual(mockery.folders.map(folder => folder.name), ['adr', 'feature']);
    assert.deepStrictEqual(mockery.folders[0].files, ['ADR-0001.md']);
    assert.deepStrictEqual(mockery.folders[1].files, ['FEAT-001.md']);

    const weather = tree.folders[1];
    assert.deepStrictEqual(weather.files, ['SPEC.md']);
  });

  test('accepts workspace-relative paths that include the .specs prefix', () => {
    const tree = buildSparkTree([
      '.specs\\Mockery\\ARCHITECTURE.md',
      '.specs\\Mockery\\feature\\FEAT-002.md',
    ]);

    assert.strictEqual(tree.folders.length, 1);
    assert.strictEqual(tree.folders[0].name, 'Mockery');
    assert.deepStrictEqual(tree.folders[0].files, ['ARCHITECTURE.md']);
    assert.deepStrictEqual(tree.folders[0].folders[0].files, ['FEAT-002.md']);
  });

  test('sorts folders and files alphabetically', () => {
    const tree = buildSparkTree([
      'Weather/ZETA.md',
      'Weather/ALPHA.md',
      'Mockery/feature/B.md',
      'Mockery/adr/A.md',
    ]);

    assert.deepStrictEqual(tree.folders.map(folder => folder.name), ['Mockery', 'Weather']);
    assert.deepStrictEqual(tree.folders[0].folders.map(folder => folder.name), ['adr', 'feature']);
    assert.deepStrictEqual(tree.folders[1].files, ['ALPHA.md', 'ZETA.md']);
  });
});
