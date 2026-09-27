import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stageCleanSkill } from '../toolings/archify-dev/src/commands/stage-clean-skill.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const canonicalZipNodeMajor = 22;
const currentNodeMajor = Number(process.versions.node.split('.')[0]);
const canonicalZipTest = (name, fn) => test(name, {
  skip: currentNodeMajor === canonicalZipNodeMajor
    ? false
    : `canonical ZIP builds require Node ${canonicalZipNodeMajor}`,
}, fn);

function spawnBuildZip(outputPath, options = {}) {
  const script = path.join(repoRoot, 'toolings/archify-dev/src/commands/build-zip.mjs');
  const { cwd = repoRoot, ...rest } = options;
  return spawnSync(process.execPath, [script, outputPath], { cwd, encoding: 'utf8', ...rest });
}

function workflowJob(workflow, name) {
  const marker = `  ${name}:`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `workflow is missing the "${name}" job`);
  const next = workflow.slice(start + marker.length).search(/\n  [a-z][a-z0-9-]*:\n/);
  return workflow.slice(start, next === -1 ? workflow.length : start + marker.length + next);
}

test('repository does not publish a GitHub Release or commit a skill archive', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, '.github', 'workflows', 'release.yml')), false);
  assert.equal(fs.existsSync(path.join(repoRoot, 'archify.zip')), false);
  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.doesNotMatch(workflow, /action-gh-release/);
  assert.doesNotMatch(workflow, /zip-freshness/);
  assert.doesNotMatch(workflow, /softprops\/action-gh-release/);
  assert.doesNotMatch(workflow, /published-update-manifest/);
  assert.doesNotMatch(workflow, /releases\/latest/);
  assert.doesNotMatch(workflow, /archify\.zip/);
  assert.match(workflow, /archify-dev package stage/);
  assert.match(workflow, /archify-dev package smoke/);
});

test('an exact tag fetch restores an annotated object after a SHA-only checkout', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-release-tag-fetch-'));
  const source = path.join(fixture, 'source');
  const checkout = path.join(fixture, 'checkout');
  const runGit = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' });

  try {
    fs.mkdirSync(source);
    assert.equal(runGit(source, ['init', '--quiet']).status, 0);
    assert.equal(runGit(source, ['config', 'user.name', 'Archify Test']).status, 0);
    assert.equal(runGit(source, ['config', 'user.email', 'archify@example.invalid']).status, 0);
    fs.writeFileSync(path.join(source, 'release.txt'), 'release\n');
    assert.equal(runGit(source, ['add', 'release.txt']).status, 0);
    assert.equal(runGit(source, ['commit', '--quiet', '-m', 'release fixture']).status, 0);
    assert.equal(runGit(source, ['tag', '-a', 'v1.0.0', '-m', 'Release v1.0.0']).status, 0);
    const commit = runGit(source, ['rev-parse', 'HEAD']).stdout.trim();

    fs.mkdirSync(checkout);
    assert.equal(runGit(checkout, ['init', '--quiet']).status, 0);
    assert.equal(runGit(checkout, ['remote', 'add', 'origin', source]).status, 0);
    assert.equal(runGit(checkout, [
      'fetch', '--no-tags', '--depth=1', 'origin',
      `+${commit}:refs/tags/v1.0.0`,
    ]).status, 0);
    assert.equal(runGit(checkout, ['cat-file', '-t', 'refs/tags/v1.0.0']).stdout.trim(), 'commit');

    assert.equal(runGit(checkout, [
      'fetch', '--force', '--no-tags', 'origin',
      '+refs/tags/v1.0.0:refs/tags/v1.0.0',
    ]).status, 0);
    assert.equal(runGit(checkout, ['cat-file', '-t', 'refs/tags/v1.0.0']).stdout.trim(), 'tag');
    assert.equal(runGit(checkout, ['rev-parse', 'refs/tags/v1.0.0^{}']).stdout.trim(), commit);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('release docs disclose that mutable Release assets are verified only at deployment time', () => {
  const design = fs.readFileSync(
    path.join(repoRoot, 'docs', 'skill-embedded-optional-update-notifier-design.md'),
    'utf8',
  );
  assert.match(design, /部署时点/);
  assert.match(design, /部署后替换[^。]*不会自动触发复验/);
  assert.match(design, /immutable release/i);
  assert.doesNotMatch(design, /即使 Release 资产后来可被替换，也不能脱离/);
});

test('GitHub Pages deploys the site dist only after every repository gate succeeds', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
  const job = workflowJob(workflow, 'deploy-pages');
  assert.match(job, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(job, /needs: \[test, webm-artifact, package-smoke\]/);
  assert.match(job, /pages: write/);
  assert.match(job, /id-token: write/);
  assert.match(job, /repos\/\$\{GITHUB_REPOSITORY\}\/git\/ref\/heads\/main/);
  assert.match(job, /current_main" == "\$GITHUB_SHA"/);
  assert.match(job, /Skipping obsolete Pages deployment/);
  assert.match(job, /if: steps\.deployment-head\.outputs\.current == 'true'/);
  assert.match(job, /GITHUB_PAGES: 'true'/);
  assert.match(job, /pnpm --filter archify-site build/);
  assert.match(job, /actions\/configure-pages@v6/);
  // v5 delegates to upload-artifact v7 (Node 24); v4 still embeds Node 20.
  assert.match(job, /actions\/upload-pages-artifact@v5\s/);
  assert.match(job, /path: apps\/site\/dist/);
  assert.doesNotMatch(job, /path: docs/);
  assert.match(job, /actions\/deploy-pages@v5/);
});

test('package smoke rejects every dependency or repository-only artifact', () => {
  const packageSmoke = path.join(repoRoot, 'toolings/archify-dev/src/commands/package-smoke.mjs');
  const forbidden = [
    { relative: 'node_modules', kind: 'directory' },
    { relative: 'package.json', kind: 'file' },
    { relative: 'package-lock.json', kind: 'file' },
    { relative: path.join('scripts', 'generate-validators.mjs'), kind: 'file' },
    { relative: 'test', kind: 'directory' },
    { relative: '.hive', kind: 'directory' },
    { relative: '.workbuddy', kind: 'directory' },
  ];

  for (const { relative, kind } of forbidden) {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-package-gate-'));
    try {
      fs.mkdirSync(path.join(fixture, 'scripts'), { recursive: true });
      fs.writeFileSync(path.join(fixture, 'scripts', 'archify.mjs'), '');
      const target = path.join(fixture, relative);
      if (kind === 'directory') fs.mkdirSync(target, { recursive: true });
      else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, '');
      }

      const result = spawnSync(process.execPath, [packageSmoke, fixture], { encoding: 'utf8' });
      assert.notEqual(result.status, 0, `${relative} must fail package smoke`);
      assert.match(
        `${result.stdout}\n${result.stderr}`,
        new RegExp(`packaged skill must not contain ${relative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
        `${relative} must be rejected explicitly`,
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  }
});

test('package smoke verifies the embedded notifier identity and local disable switch', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'toolings/archify-dev/src/commands/package-smoke.mjs'), 'utf8');
  assert.match(source, /scripts', 'check-update\.mjs/);
  assert.match(source, /scripts', 'update-contract\.mjs/);
  assert.match(source, /skill-release\.json/);
  assert.match(source, /ARCHIFY_UPDATE_CHECK_DISABLED: '1'/);
  assert.match(source, /reason !== 'disabled'/);
});

test('package smoke rejects a missing or modified distribution license', () => {
  const packageSmoke = path.join(repoRoot, 'toolings/archify-dev/src/commands/package-smoke.mjs');
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-package-license-gate-'));
  try {
    const staged = path.join(fixture, 'archify');
    stageCleanSkill({ repoRoot, destination: staged });
    const licensePath = path.join(staged, 'LICENSE');

    fs.rmSync(licensePath);
    let result = spawnSync(process.execPath, [packageSmoke, staged], { encoding: 'utf8' });
    assert.notEqual(result.status, 0, 'missing LICENSE must fail package smoke');
    assert.match(`${result.stdout}\n${result.stderr}`, /packaged skill is missing LICENSE/);

    const repositoryLicense = fs.readFileSync(path.join(repoRoot, 'LICENSE'), 'utf8');
    fs.writeFileSync(
      licensePath,
      repositoryLicense.replace(
        'Copyright (c) 2025 Cocoon AI',
        'Copyright (c) 2025 Cocoon AI (original "architecture-diagram-generator")',
      ),
    );
    result = spawnSync(process.execPath, [packageSmoke, staged], { encoding: 'utf8' });
    assert.notEqual(result.status, 0, 'modified upstream notice must fail package smoke');
    assert.match(`${result.stdout}\n${result.stderr}`, /missing the exact Cocoon AI copyright line/);

    fs.writeFileSync(licensePath, 'Copyright (c) 2025 Cocoon AI\n');
    result = spawnSync(process.execPath, [packageSmoke, staged], { encoding: 'utf8' });
    assert.notEqual(result.status, 0, 'truncated LICENSE must fail package smoke');
    assert.match(`${result.stdout}\n${result.stderr}`, /must byte-match the repository LICENSE/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('package smoke rejects missing, modified, or incomplete third-party notices', () => {
  const packageSmoke = path.join(repoRoot, 'toolings/archify-dev/src/commands/package-smoke.mjs');
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-package-notices-gate-'));
  try {
    const staged = path.join(fixture, 'archify');
    stageCleanSkill({ repoRoot, destination: staged });
    const noticesPath = path.join(staged, 'THIRD_PARTY_NOTICES.md');

    fs.rmSync(noticesPath);
    let result = spawnSync(process.execPath, [packageSmoke, staged], { encoding: 'utf8' });
    assert.notEqual(result.status, 0, 'missing notices must fail package smoke');
    assert.match(`${result.stdout}\n${result.stderr}`, /missing THIRD_PARTY_NOTICES\.md/);

    const repositoryNotices = fs.readFileSync(path.join(repoRoot, 'THIRD_PARTY_NOTICES.md'), 'utf8');
    fs.writeFileSync(noticesPath, repositoryNotices.replace('Simple Icons 16.28.0', 'Simple Icons'));
    result = spawnSync(process.execPath, [packageSmoke, staged], { encoding: 'utf8' });
    assert.notEqual(result.status, 0, 'modified notices must fail package smoke');
    assert.match(`${result.stdout}\n${result.stderr}`, /must byte-match the repository notice/);

    fs.writeFileSync(noticesPath, 'Simple Icons 16.28.0\n');
    result = spawnSync(process.execPath, [packageSmoke, staged], { encoding: 'utf8' });
    assert.notEqual(result.status, 0, 'incomplete notices must fail package smoke');
    assert.match(`${result.stdout}\n${result.stderr}`, /packaged THIRD_PARTY_NOTICES\.md is incomplete/);

    const comparisonRoot = path.join(fixture, 'comparison-root');
    fs.mkdirSync(comparisonRoot);
    fs.copyFileSync(path.join(repoRoot, 'LICENSE'), path.join(comparisonRoot, 'LICENSE'));
    const synchronizedIncomplete = repositoryNotices
      .replace(/## OpenAI mark[\s\S]*?## No additional rights granted/, '## No additional rights granted');
    fs.writeFileSync(path.join(comparisonRoot, 'THIRD_PARTY_NOTICES.md'), synchronizedIncomplete);
    fs.writeFileSync(noticesPath, synchronizedIncomplete);
    result = spawnSync(process.execPath, [packageSmoke, staged], {
      encoding: 'utf8',
      env: {
        ...process.env,
        ARCHIFY_PACKAGE_SMOKE_NOTICE_ROOT: comparisonRoot,
      },
    });
    assert.notEqual(result.status, 0, 'byte-identical incomplete notices must fail package smoke');
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /repository THIRD_PARTY_NOTICES\.md is incomplete; missing required disclosure: .*OpenAI/,
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('package smoke increments an arbitrary-precision SemVer patch without Number coercion', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-package-bigint-version-'));
  const skillRoot = path.join(scratch, 'archify');
  try {
    stageCleanSkill({ repoRoot, destination: skillRoot });
    const releasePath = path.join(skillRoot, 'skill-release.json');
    const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
    const version = '2.16.9007199254740993';
    release.version = version;
    release.channel = 'stable';
    fs.writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);
    assert.equal(fs.existsSync(path.join(skillRoot, 'package.json')), false);

    const smoke = spawnSync(process.execPath, [path.join(repoRoot, 'toolings/archify-dev/src/commands/package-smoke.mjs'), skillRoot], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    assert.equal(smoke.status, 0, smoke.stderr || smoke.stdout);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('archive build refuses to silently omit required release files', () => {
  const buildSource = fs.readFileSync(path.join(repoRoot, 'toolings/archify-dev/src/commands/build-zip.mjs'), 'utf8');
  const stageSource = fs.readFileSync(path.join(repoRoot, 'toolings/archify-dev/src/commands/stage-clean-skill.mjs'), 'utf8');
  assert.match(buildSource, /stage-clean-skill\.mjs/);
  assert.match(stageSource, /archify\/LICENSE/);
  assert.match(stageSource, /archify\/THIRD_PARTY_NOTICES\.md/);
  assert.match(stageSource, /archify\/skill-release\.json/);
  assert.match(stageSource, /archify\/scripts\/check-update\.mjs/);
  assert.match(stageSource, /archify\/scripts\/update-contract\.mjs/);
  assert.match(stageSource, /git', \['ls-files', '--stage', '-z'/);
  assert.match(stageSource, /required package input is not tracked by Git/);
  assert.match(stageSource, /required repository input is not tracked by Git/);
});

canonicalZipTest('built skill archives omit npm manifests and reject a packaged package.json', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-built-package-gate-'));
  try {
    const archive = path.join(fixture, 'archify.zip');
    const build = spawnBuildZip(archive);
    assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

    const extracted = path.join(fixture, 'extracted');
    fs.mkdirSync(extracted);
    const unzip = spawnSync('unzip', ['-q', archive, '-d', extracted], { encoding: 'utf8' });
    assert.equal(unzip.status, 0, `${unzip.stdout}\n${unzip.stderr}`);
    const builtPackage = path.join(extracted, 'archify');
    assert.equal(fs.existsSync(path.join(builtPackage, 'package.json')), false);
    assert.equal(fs.existsSync(path.join(builtPackage, 'package-lock.json')), false);
    const caseRoot = path.join(fixture, 'with-package-json');
    fs.cpSync(builtPackage, caseRoot, { recursive: true });
    fs.writeFileSync(path.join(caseRoot, 'package.json'), `${JSON.stringify({
      dependencies: { runtime: '1.0.0' },
    }, null, 2)}\n`);

    const result = spawnSync(process.execPath, [path.join(repoRoot, 'toolings/archify-dev/src/commands/package-smoke.mjs'), caseRoot], {
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, 'a skill package.json must fail package smoke');
    assert.match(`${result.stdout}\n${result.stderr}`, /packaged skill must not contain package\.json/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

canonicalZipTest('built archives contain the embedded notifier runtime', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-notifier-package-gate-'));
  try {
    const archive = path.join(fixture, 'archify.zip');
    const build = spawnBuildZip(archive);
    assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

    const listing = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
    assert.equal(listing.status, 0, `${listing.stdout}\n${listing.stderr}`);
    const entries = new Set(listing.stdout.trim().split('\n'));
    assert.ok(entries.has('archify/skill-release.json'));
    assert.ok(entries.has('archify/scripts/check-update.mjs'));
    assert.ok(entries.has('archify/scripts/update-contract.mjs'));
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

canonicalZipTest('archive build excludes untracked files and external symlinks from the live working tree', () => {
  const marker = `.package-negative-${process.pid}-${Date.now()}`;
  const untracked = path.join(repoRoot, 'archify', `${marker}.txt`);
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-package-external-'));
  const externalTarget = path.join(externalRoot, 'secret.txt');
  const externalLink = path.join(repoRoot, 'archify', `${marker}.link`);
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-package-negative-'));
  const archive = path.join(outputRoot, 'archify.zip');

  try {
    fs.writeFileSync(untracked, 'must not ship\n');
    fs.writeFileSync(externalTarget, 'external content must not ship\n');
    fs.symlinkSync(externalTarget, externalLink, 'file');

    const build = spawnBuildZip(archive);
    assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

    const listing = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
    assert.equal(listing.status, 0, `${listing.stdout}\n${listing.stderr}`);
    assert.doesNotMatch(listing.stdout, new RegExp(marker), 'untracked files and symlinks must not enter the archive');
  } finally {
    fs.rmSync(untracked, { force: true });
    fs.rmSync(externalLink, { force: true });
    fs.rmSync(externalRoot, { recursive: true, force: true });
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
});

canonicalZipTest('archive build rejects an unmerged index and preserves an existing archive', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-package-unmerged-'));
  const scripts = path.join(fixture, 'toolings', 'archify-dev', 'src', 'commands');
  const skill = path.join(fixture, 'archify');
  const license = path.join(skill, 'LICENSE');
  const archive = path.join(fixture, 'trusted.zip');
  const trusted = Buffer.from('trusted archive bytes');
  const git = (args, options = {}) => spawnSync('git', args, {
    cwd: fixture,
    encoding: 'utf8',
    ...options,
  });

  try {
    fs.mkdirSync(path.join(skill, 'renderers', 'shared'), { recursive: true });
    fs.mkdirSync(path.join(skill, 'scripts'), { recursive: true });
    fs.mkdirSync(scripts, { recursive: true });
    fs.copyFileSync(path.join(repoRoot, 'toolings/archify-dev/src/commands/build-zip.mjs'), path.join(scripts, 'build-zip.mjs'));
    fs.copyFileSync(
      path.join(repoRoot, 'toolings/archify-dev/src/commands/write-deterministic-zip.mjs'),
      path.join(scripts, 'write-deterministic-zip.mjs'),
    );
    fs.copyFileSync(
      path.join(repoRoot, 'toolings/archify-dev/src/commands/stage-clean-skill.mjs'),
      path.join(scripts, 'stage-clean-skill.mjs'),
    );
    fs.copyFileSync(
      path.join(repoRoot, 'toolings/archify-dev/src/commands/third-party-notices-contract.mjs'),
      path.join(scripts, 'third-party-notices-contract.mjs'),
    );
    fs.writeFileSync(path.join(skill, 'renderers', 'shared', 'generated-validators.mjs'), 'export default {};\n');
    fs.writeFileSync(path.join(skill, 'scripts', 'check-update.mjs'), 'export {};\n');
    fs.writeFileSync(path.join(skill, 'scripts', 'update-contract.mjs'), 'export {};\n');
    fs.writeFileSync(path.join(skill, 'skill-release.json'), '{}\n');
    fs.writeFileSync(path.join(skill, 'package.json'), '{"name":"archify"}\n');
    fs.writeFileSync(license, 'base\n');
    assert.equal(git(['init']).status, 0);
    assert.equal(git(['add', '.']).status, 0);

    const base = git(['hash-object', '-w', '--stdin'], { input: 'base\n' });
    const ours = git(['hash-object', '-w', '--stdin'], { input: 'ours\n' });
    const theirs = git(['hash-object', '-w', '--stdin'], { input: 'theirs\n' });
    for (const result of [base, ours, theirs]) assert.equal(result.status, 0, result.stderr);
    const indexInfo = [
      `100644 ${base.stdout.trim()} 1\tarchify/LICENSE`,
      `100644 ${ours.stdout.trim()} 2\tarchify/LICENSE`,
      `100644 ${theirs.stdout.trim()} 3\tarchify/LICENSE`,
      '',
    ].join('\n');
    assert.equal(git(['update-index', '--index-info'], { input: indexInfo }).status, 0);
    fs.writeFileSync(license, '<<<<<<< ours\n=======\n>>>>>>> theirs\n');
    fs.writeFileSync(archive, trusted);

    const build = spawnSync(process.execPath, [path.join(scripts, 'build-zip.mjs'), archive], {
      cwd: fixture,
      encoding: 'utf8',
    });
    assert.notEqual(build.status, 0, `${build.stdout}\n${build.stderr}`);
    assert.match(build.stderr, /refusing to package unmerged index entry/);
    assert.ok(fs.readFileSync(archive).equals(trusted), 'a failed build must preserve the trusted archive');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('archive build rejects non-canonical Node versions before publishing output', {
  skip: currentNodeMajor === canonicalZipNodeMajor
    ? `requires a Node major other than ${canonicalZipNodeMajor}`
    : false,
}, () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-package-node-version-'));
  try {
    const archive = path.join(outputRoot, 'archify.zip');
    const trusted = Buffer.from('existing canonical archive');
    fs.writeFileSync(archive, trusted);
    const build = spawnBuildZip(archive);
    assert.notEqual(build.status, 0, `${build.stdout}\n${build.stderr}`);
    assert.match(build.stderr, /canonical archify\.zip builds require Node 22/);
    assert.ok(fs.readFileSync(archive).equals(trusted), 'version rejection must preserve the canonical archive');
  } finally {
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
});

canonicalZipTest('archive build is byte-for-byte reproducible across caller time zones without system zip', () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-package-reproducible-'));
  const utcArchive = path.join(outputRoot, 'utc.zip');
  const honoluluArchive = path.join(outputRoot, 'honolulu.zip');

  try {
    for (const [archive, timezone] of [
      [utcArchive, 'UTC'],
      [honoluluArchive, 'Pacific/Honolulu'],
    ]) {
      const build = spawnBuildZip(archive, {
        env: { ...process.env, TZ: timezone },
      });
      assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
    }

    assert.ok(
      fs.readFileSync(utcArchive).equals(fs.readFileSync(honoluluArchive)),
      'identical tracked inputs must produce identical archive bytes',
    );
    assert.deepEqual(
      fs.readdirSync(outputRoot).sort(),
      ['honolulu.zip', 'utc.zip'],
      'successful archive publication must not leave temporary files behind',
    );
  } finally {
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('archive build accepts Windows-style absolute output paths', {
  skip: process.platform !== 'win32'
    ? 'Windows drive paths only reach build-zip.mjs on win32'
    : currentNodeMajor === canonicalZipNodeMajor
      ? false
      : `canonical ZIP builds require Node ${canonicalZipNodeMajor}`,
}, () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-package-windows-path-'));
  const backslashArchive = path.win32.join(outputRoot, 'backslash.zip');
  const slashArchive = path.win32.join(outputRoot, 'slash.zip').replace(/\\/g, '/');
  // The \\.\ device-namespace form is a \\-prefixed absolute path like a UNC
  // share: MSYS passes it to bash unchanged from a native parent and Node
  // resolves it natively. A real network share cannot be assumed in the suite,
  // and the \\?\ extended-length prefix is stripped by MSYS's command-line
  // parsing when bash is started from a native process.
  const deviceArchive = `\\\\.\\${path.win32.join(outputRoot, 'device.zip')}`;

  try {
    for (const archive of [backslashArchive, slashArchive, deviceArchive]) {
      const build = spawnBuildZip(archive);
      assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
      assert.ok(fs.existsSync(archive), `archive must be written to the requested path: ${archive}`);
    }
    const reference = fs.readFileSync(backslashArchive);
    for (const archive of [slashArchive, deviceArchive]) {
      assert.ok(
        reference.equals(fs.readFileSync(archive)),
        `every Windows path form must produce identical archive bytes: ${archive}`,
      );
    }
    assert.deepEqual(
      fs.readdirSync(outputRoot).sort(),
      ['backslash.zip', 'device.zip', 'slash.zip'],
      'successful archive publication must not leave temporary files behind',
    );
  } finally {
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
});

function centralDirectoryModes(archive) {
  const buffer = fs.readFileSync(archive);
  const end = buffer.length - 22;
  assert.equal(buffer.readUInt32LE(end), 0x06054b50, 'archive must end with an end-of-central-directory record');
  const entryCount = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const modes = {};
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50, 'central directory entry signature');
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    modes[name] = (buffer.readUInt32LE(offset + 38) >>> 16) & 0o7777;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return modes;
}

function writeArchive(stagedRoot, archive, modeManifest) {
  const args = [path.join(repoRoot, 'toolings/archify-dev/src/commands/write-deterministic-zip.mjs'), stagedRoot, archive];
  if (modeManifest !== null) args.push('--mode-manifest', modeManifest);
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}

function stagedFixture(files) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-zip-modes-'));
  const staged = path.join(fixture, 'archify');
  for (const [relative, { content, mode }] of Object.entries(files)) {
    const target = path.join(staged, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    fs.chmodSync(target, mode);
  }
  return { fixture, staged };
}

test('archive writer records Git index modes from the manifest, not filesystem bits', () => {
  const { fixture, staged } = stagedFixture({
    'scripts/tool.mjs': { content: '#!/usr/bin/env node\n', mode: 0o644 },
    'docs/notes.txt': { content: 'notes\n', mode: 0o755 },
  });
  try {
    const manifest = path.join(fixture, 'modes.json');
    fs.writeFileSync(manifest, JSON.stringify({ 'scripts/tool.mjs': '100755', 'docs/notes.txt': '100644' }));

    const first = path.join(fixture, 'first.zip');
    const build = writeArchive(staged, first, manifest);
    assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
    assert.deepEqual(centralDirectoryModes(first), {
      'archify/scripts/tool.mjs': 0o755,
      'archify/docs/notes.txt': 0o644,
    });

    // Flip the on-disk bits; the recorded modes must still decide the bytes.
    fs.chmodSync(path.join(staged, 'scripts', 'tool.mjs'), 0o755);
    fs.chmodSync(path.join(staged, 'docs', 'notes.txt'), 0o644);
    const second = path.join(fixture, 'second.zip');
    const rebuild = writeArchive(staged, second, manifest);
    assert.equal(rebuild.status, 0, `${rebuild.stdout}\n${rebuild.stderr}`);
    assert.ok(
      fs.readFileSync(first).equals(fs.readFileSync(second)),
      'archive bytes must not depend on filesystem permission bits',
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('archive writer fails closed when the mode manifest and the staged tree disagree', () => {
  const { fixture, staged } = stagedFixture({
    'bin/tool.mjs': { content: '#!/usr/bin/env node\n', mode: 0o755 },
    'docs/notes.txt': { content: 'notes\n', mode: 0o644 },
  });
  try {
    const archive = path.join(fixture, 'out.zip');
    const cases = [
      [null, /--mode-manifest/, 2],
      [{ 'bin/tool.mjs': '100755' }, /no recorded Git mode: docs\/notes\.txt/, 1],
      [{ 'bin/tool.mjs': '100755', 'docs/notes.txt': '100644', 'extra.txt': '100644' }, /not staged: extra\.txt/, 1],
      [{ 'bin/tool.mjs': '100777', 'docs/notes.txt': '100644' }, /unsupported Git mode "100777"/, 1],
    ];
    for (const [manifestContent, expected, status] of cases) {
      let manifest = null;
      if (manifestContent !== null) {
        manifest = path.join(fixture, 'modes.json');
        fs.writeFileSync(manifest, JSON.stringify(manifestContent));
      }
      const build = writeArchive(staged, archive, manifest);
      assert.equal(build.status, status, `${build.stdout}\n${build.stderr}`);
      assert.match(build.stderr, expected);
      assert.equal(fs.existsSync(archive), false, 'a rejected build must not publish an archive');
      assert.deepEqual(
        fs.readdirSync(fixture).filter((name) => name.endsWith('.tmp')),
        [],
        'a rejected build must not leave temporary files behind',
      );
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('archive build hands the recorded Git index modes from the stager to the writer', () => {
  const buildSource = fs.readFileSync(path.join(repoRoot, 'toolings/archify-dev/src/commands/build-zip.mjs'), 'utf8');
  assert.match(buildSource, /stage-clean-skill\.mjs[\s\S]*?--mode-manifest', manifest/);
  assert.match(buildSource, /write-deterministic-zip\.mjs[\s\S]*?--mode-manifest', manifest/);
});

test('CI tests every Node lane supported by the workspace toolchain', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.engines?.node, '>=18');

  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
  const testJob = workflowJob(workflow, 'test');
  const versions = testJob.match(/node-version:\s*\[([^\]]+)\]/)?.[1]
    .split(',')
    .map((version) => Number(version.trim()));
  assert.ok(versions, 'test job must declare an explicit Node version matrix');
  for (const version of [22, 24]) {
    assert.ok(versions.includes(version), `test matrix must cover Node ${version}`);
  }
  assert.ok(!versions.includes(18) && !versions.includes(20), 'workspace toolchain requires Node 22.12 or newer');

  const packageSmokeJob = workflowJob(workflow, 'package-smoke');
  assert.match(packageSmokeJob, /os:\s*\[ubuntu-latest, macos-latest, windows-latest\]/);
  assert.match(packageSmokeJob, /node-version:\s*22/);
});
