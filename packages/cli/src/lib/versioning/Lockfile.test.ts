/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs-extra';
import { BackstagePackage } from '@backstage/cli-node';
import { Lockfile } from './Lockfile';
import { createMockDirectory } from '@backstage/backend-test-utils';

const LEGACY_HEADER = `# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1

`;

const MODERN_HEADER = `# This file is generated by running "yarn install" inside your project.
# Manual changes might be lost - proceed with caution!

__metadata:
  version: 6
  cacheKey: 8
`;

const mockA = `${LEGACY_HEADER}
a@^1:
  version "1.0.1"
  resolved "https://my-registry/a-1.0.01.tgz#abc123"
  integrity sha512-xyz
  dependencies:
    b "^2"

b@2.0.x:
  version "2.0.1"

b@^2:
  version "2.0.0"
`;

const mockADedup = `${LEGACY_HEADER}
a@^1:
  version "1.0.1"
  resolved "https://my-registry/a-1.0.01.tgz#abc123"
  integrity sha512-xyz
  dependencies:
    b "^2"

b@2.0.x, b@^2:
  version "2.0.1"
`;

const mockB = `${LEGACY_HEADER}
"@s/a@*", "@s/a@1 || 2", "@s/a@^1":
  version "1.0.1"

"@s/a@^2.0.x":
  version "2.0.0"
`;

const mockBDedup = `${LEGACY_HEADER}
"@s/a@*", "@s/a@1 || 2", "@s/a@^2.0.x":
  version "2.0.0"

"@s/a@^1":
  version "1.0.1"
`;

describe('Lockfile', () => {
  const mockDir = createMockDirectory();

  it('should load and serialize mockA', async () => {
    mockDir.setContent({
      'yarn.lock': mockA,
    });

    const lockfile = await Lockfile.load(mockDir.resolve('yarn.lock'));
    expect(lockfile.get('a')).toEqual([
      { range: '^1', version: '1.0.1', dataKey: 'a@^1' },
    ]);
    expect(lockfile.get('b')).toEqual([
      { range: '2.0.x', version: '2.0.1', dataKey: 'b@2.0.x' },
      { range: '^2', version: '2.0.0', dataKey: 'b@^2' },
    ]);
    expect(lockfile.toString()).toBe(mockA);
  });

  it('should deduplicate and save mockA', async () => {
    mockDir.setContent({
      'yarn.lock': mockA,
    });

    const lockfilePath = mockDir.resolve('yarn.lock');
    const lockfile = await Lockfile.load(lockfilePath);
    const result = lockfile.analyze({ localPackages: new Map() });
    expect(result).toEqual({
      invalidRanges: [],
      newRanges: [],
      newVersions: [
        {
          name: 'b',
          range: '^2',
          oldVersion: '2.0.0',
          newVersion: '2.0.1',
        },
      ],
    });

    expect(lockfile.toString()).toBe(mockA);
    lockfile.replaceVersions(result.newVersions);
    expect(lockfile.toString()).toBe(mockADedup);

    await expect(fs.readFile(lockfilePath, 'utf8')).resolves.toBe(mockA);
    await expect(lockfile.save(lockfilePath)).resolves.toBeUndefined();
    await expect(fs.readFile(lockfilePath, 'utf8')).resolves.toBe(mockADedup);
  });

  it('should deduplicate mockB', async () => {
    mockDir.setContent({
      'yarn.lock': mockB,
    });

    const lockfile = await Lockfile.load(mockDir.resolve('yarn.lock'));
    const result = lockfile.analyze({ localPackages: new Map() });
    expect(result).toEqual({
      invalidRanges: [],
      newRanges: [
        {
          name: '@s/a',
          oldRange: '^1',
          newRange: '^2.0.x',
          oldVersion: '1.0.1',
          newVersion: '2.0.0',
        },
      ],
      newVersions: [
        {
          name: '@s/a',
          range: '*',
          oldVersion: '1.0.1',
          newVersion: '2.0.0',
        },
        {
          name: '@s/a',
          range: '1 || 2',
          oldVersion: '1.0.1',
          newVersion: '2.0.0',
        },
      ],
    });

    expect(lockfile.toString()).toBe(mockB);
    lockfile.replaceVersions(result.newVersions);
    expect(lockfile.toString()).toBe(mockBDedup);
  });
});

const mockANew = `${MODERN_HEADER}
a@^1:
  version: 1.0.1
  dependencies:
    b: ^2
  integrity: sha512-xyz
  resolved: "https://my-registry/a-1.0.01.tgz#abc123"

"b@2.0.x, b@^2.0.1":
  version: 2.0.1

b@^2:
  version: 2.0.0
`;

const mockANewDedup = `${MODERN_HEADER}
a@^1:
  version: 1.0.1
  dependencies:
    b: ^2
  integrity: sha512-xyz
  resolved: "https://my-registry/a-1.0.01.tgz#abc123"

"b@2.0.x, b@^2.0.1":
  version: 2.0.1

b@^2:
  version: 2.0.1
`;

const mockANewLocal = `${MODERN_HEADER}
a@^1:
  version: 1.0.1
  dependencies:
    b: ^2
  integrity: sha512-xyz
  resolved: "https://my-registry/a-1.0.01.tgz#abc123"

"b@2.0.x, b@^2.0.1":
  version: 0.0.0-use.local

b@^2:
  version: 2.0.0
`;

const mockANewLocalDedup = `${MODERN_HEADER}
a@^1:
  version: 1.0.1
  dependencies:
    b: ^2
  integrity: sha512-xyz
  resolved: "https://my-registry/a-1.0.01.tgz#abc123"

"b@2.0.x, b@^2.0.1":
  version: 0.0.0-use.local

b@^2:
  version: 0.0.0-use.local
`;

describe('New Lockfile', () => {
  const mockDir = createMockDirectory();

  it('should load and serialize mockANew', async () => {
    mockDir.setContent({
      'yarn.lock': mockANew,
    });

    const lockfile = await Lockfile.load(mockDir.resolve('yarn.lock'));
    expect(lockfile.get('a')).toEqual([
      { range: '^1', version: '1.0.1', dataKey: 'a@^1' },
    ]);
    expect(lockfile.get('b')).toEqual([
      { range: '2.0.x', version: '2.0.1', dataKey: 'b@2.0.x, b@^2.0.1' },
      { range: '^2.0.1', version: '2.0.1', dataKey: 'b@2.0.x, b@^2.0.1' },
      { range: '^2', version: '2.0.0', dataKey: 'b@^2' },
    ]);
    expect(lockfile.toString()).toBe(mockANew);
  });

  it('should deduplicate and save mockANew', async () => {
    mockDir.setContent({
      'yarn.lock': mockANew,
    });

    const lockfilePath = mockDir.resolve('yarn.lock');
    const lockfile = await Lockfile.load(lockfilePath);
    const result = lockfile.analyze({ localPackages: new Map() });
    expect(result).toEqual({
      invalidRanges: [],
      newRanges: [],
      newVersions: [
        {
          name: 'b',
          range: '^2',
          oldVersion: '2.0.0',
          newVersion: '2.0.1',
        },
      ],
    });

    expect(lockfile.toString()).toBe(mockANew);
    lockfile.replaceVersions(result.newVersions);
    expect(lockfile.toString()).toBe(mockANewDedup);

    await expect(fs.readFile(lockfilePath, 'utf8')).resolves.toBe(mockANew);
    await expect(lockfile.save(lockfilePath)).resolves.toBeUndefined();
    await expect(fs.readFile(lockfilePath, 'utf8')).resolves.toBe(
      mockANewDedup,
    );
  });

  it('should deduplicate and save mockANewLocal', async () => {
    mockDir.setContent({
      'yarn.lock': mockANewLocal,
    });

    const lockfilePath = mockDir.resolve('yarn.lock');
    const lockfile = await Lockfile.load(lockfilePath);
    const result = lockfile.analyze({
      localPackages: new Map([
        [
          'b',
          {
            packageJson: { version: '2.0.1' },
          } as BackstagePackage,
        ],
      ]),
    });
    expect(result).toEqual({
      invalidRanges: [],
      newRanges: [],
      newVersions: [
        {
          name: 'b',
          range: '^2',
          oldVersion: '2.0.0',
          newVersion: '0.0.0-use.local',
        },
      ],
    });

    expect(lockfile.toString()).toBe(mockANewLocal);
    lockfile.replaceVersions(result.newVersions);
    expect(lockfile.toString()).toBe(mockANewLocalDedup);

    await expect(fs.readFile(lockfilePath, 'utf8')).resolves.toBe(
      mockANewLocal,
    );
    await expect(lockfile.save(lockfilePath)).resolves.toBeUndefined();
    await expect(fs.readFile(lockfilePath, 'utf8')).resolves.toBe(
      mockANewLocalDedup,
    );
  });
});
