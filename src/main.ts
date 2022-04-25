import * as assert from 'assert';
import * as core from '@actions/core';
import * as path from 'path';
import * as semver from 'semver';
import {
  logger,
  execute,
  exitFailure,
  exitSuccess,
  getEnv,
} from './utils';
import { ActionConfig } from './action-config';
import { PackageReader } from './package-reader';

export async function run() {
  try {
    // parse our action configuration
    const config = new ActionConfig();
    const searchTarget = core.getInput('search-target', { required: true });
    // load the package.json
    const packagePath = path.join(getEnv('GITHUB_WORKSPACE'), 'package.json');
    const packageReader = new PackageReader(packagePath);
    const currentVersion = packageReader.version;
    // get the bumped version
    const bumpType = getBumpType(config, searchTarget);
    const bumpedVersion = bumpVersion(packageReader.version, bumpType);
    // update and save the package.json
    packageReader.version = bumpedVersion;
    packageReader.save();
    // commit and push the version bump changes
    execute('git add ./package.json');
    execute(
      `git commit -m "${getCommitMessage(config.commitMessage, bumpedVersion)}"`
    );
    execute('git push');

    // output the newly bumped version
    core.setOutput('bumped_version', bumpedVersion);

    exitSuccess(`Bumped version ${currentVersion} -> ${bumpedVersion}`);
  } catch (e) {
    exitFailure(`Action failed; with error: ${e}`);
  }
}

function getCommitMessage(message: string, version: string) {
  return message.replace(/{version}/g, version);
}

function getBumpType(config: ActionConfig, target: string) {
  let matchResult = '';

  for (let i = 0; i < config.bumpTypes.length; i++) {
    const { type, keywords } = config.bumpTypes[i];

    // check the keywords
    const matchedKeyword = keywords.find((word) => target.includes(word));
    if (matchedKeyword) {
      logger.success(
        `Found keyword match: ${matchedKeyword}; for bump type: ${type}`
      );
      matchResult = type;
      break;
    }
  }

  if (!matchResult) {
    matchResult = config.defaultBumpType;
    logger.warn(`No matches found; using default bump type: ${matchResult}`);
  }
  logger.success(`Using bump type: ${matchResult}`);
  return matchResult as semver.ReleaseType;
}

function bumpVersion(currentVersion: string, type: semver.ReleaseType) {
  try {
    // bump the current version
    const bumpedVersion = semver.inc(
      currentVersion,
      type as semver.ReleaseType
    );
    // verify the version post-bump
    assert.ok(
      bumpedVersion,
      `Invalid post-bump version; bumped with type: ${type}`
    );
    return bumpedVersion;
  } catch (e) {
    exitFailure(`Could not bump version; with error: ${e}`);
  }
}
