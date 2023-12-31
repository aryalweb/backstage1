## API Report File for "@backstage/plugin-jenkins-backend"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts
import { BackendFeature } from '@backstage/backend-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';
import { CompoundEntityRef } from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import express from 'express';
import { Logger } from 'winston';
import { PermissionAuthorizer } from '@backstage/plugin-permission-common';
import { PermissionEvaluator } from '@backstage/plugin-permission-common';

// @public (undocumented)
export function createRouter(options: RouterOptions): Promise<express.Router>;

// @public
export class DefaultJenkinsInfoProvider implements JenkinsInfoProvider {
  // (undocumented)
  static fromConfig(options: {
    config: Config;
    catalog: CatalogApi;
  }): DefaultJenkinsInfoProvider;
  // (undocumented)
  getInstance(opt: {
    entityRef: CompoundEntityRef;
    jobFullName?: string;
    backstageToken?: string;
  }): Promise<JenkinsInfo>;
  // (undocumented)
  static readonly NEW_JENKINS_ANNOTATION = 'jenkins.io/job-full-name';
  // (undocumented)
  static readonly OLD_JENKINS_ANNOTATION = 'jenkins.io/github-folder';
}

// @public
export class JenkinsConfig {
  constructor(instances: JenkinsInstanceConfig[]);
  static fromConfig(config: Config): JenkinsConfig;
  getInstanceConfig(jenkinsName?: string): JenkinsInstanceConfig;
  // (undocumented)
  readonly instances: JenkinsInstanceConfig[];
}

// @public (undocumented)
export interface JenkinsInfo {
  // (undocumented)
  baseUrl: string;
  // (undocumented)
  crumbIssuer?: boolean;
  // (undocumented)
  headers?: Record<string, string | string[]>;
  // (undocumented)
  jobFullName: string;
}

// @public (undocumented)
export interface JenkinsInfoProvider {
  // (undocumented)
  getInstance(options: {
    entityRef: CompoundEntityRef;
    jobFullName?: string;
    backstageToken?: string;
  }): Promise<JenkinsInfo>;
}

// @public (undocumented)
export interface JenkinsInstanceConfig {
  // (undocumented)
  apiKey: string;
  // (undocumented)
  baseUrl: string;
  // (undocumented)
  crumbIssuer?: boolean;
  extraRequestHeaders?: Record<string, string>;
  // (undocumented)
  name: string;
  // (undocumented)
  username: string;
}

// @public
const jenkinsPlugin: () => BackendFeature;
export default jenkinsPlugin;

// @public (undocumented)
export interface RouterOptions {
  // (undocumented)
  jenkinsInfoProvider: JenkinsInfoProvider;
  // (undocumented)
  logger: Logger;
  // (undocumented)
  permissions?: PermissionEvaluator | PermissionAuthorizer;
}
```
