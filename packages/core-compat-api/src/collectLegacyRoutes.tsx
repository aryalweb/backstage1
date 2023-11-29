/*
 * Copyright 2023 The Backstage Authors
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

import {
  AnyRouteRefParams,
  BackstagePlugin as LegacyBackstagePlugin,
  RouteRef,
  getComponentData,
} from '@backstage/core-plugin-api';
import {
  BackstagePlugin,
  ExtensionDefinition,
  coreExtensionData,
  createApiExtension,
  createExtension,
  createExtensionInput,
  createPageExtension,
  createPlugin,
} from '@backstage/frontend-plugin-api';
import React, { Children, Fragment, ReactNode, isValidElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { convertLegacyRouteRef } from './convertLegacyRouteRef';

/*

# Legacy interoperability

Use-cases (prioritized):
 1. Slowly migrate over an existing app to DI, piece by piece
 2. Use a legacy plugin in a new DI app
 3. Use DI in an existing legacy app

Starting point: use-case #1

Potential solutions:
 1. Codemods (we're not considering this for now)
 2. Legacy apps are migrated bottom-up, i.e. keep legacy root, replace pages with DI
 3. Legacy apps are migrated top-down i.e. switch out base to DI, legacy adapter allows for usage of existing app structure

Chosen path: #3

Existing tasks:
  - Adopters can migrate their existing app gradually (~4)
    - Example-app uses legacy base with DI adapters
    - Create an API that lets you inject DI into existing apps - working assumption is that this is enough
  - Adopters can use legacy plugins in DI through adapters (~8)
    - App-next uses DI base with legacy adapters
    - Create a legacy adapter that is able to take an existing extension tree

*/

function visitRouteChildren(
  rootNode: ReactNode,
  parentName: string | undefined,
  createdPluginIds: Map<LegacyBackstagePlugin, ExtensionDefinition<unknown>[]>,
): ExtensionDefinition<unknown>[] {
  return Children.toArray(rootNode).flatMap((node, index) => {
    if (!isValidElement(node)) {
      return [];
    }

    const name = `${parentName}.${index}`;

    if (node.type === Fragment) {
      return visitRouteChildren(node.props.children, name, createdPluginIds);
    }

    const plugin = getComponentData<LegacyBackstagePlugin>(node, 'core.plugin');
    if (plugin) {
      if (!createdPluginIds.has(plugin)) {
        createdPluginIds.set(plugin, []);
      }
    }

    const routeRef = getComponentData<RouteRef<AnyRouteRefParams>>(
      node,
      'core.mountPoint',
    );
    const routePath: string | undefined = node.props.path;

    if (!routeRef && !routePath) {
      return visitRouteChildren(node.props.children, name, createdPluginIds);
    }

    const extension = createExtension({
      kind: 'routing-shim',
      name,
      attachTo: { id: `routing-shim:${parentName}`, input: 'children' },
      inputs: {
        children: createExtensionInput({
          routePath: coreExtensionData.routePath.optional(),
          routeRef: coreExtensionData.routeRef.optional(),
        }),
      },
      output: {
        routePath: coreExtensionData.routePath.optional(),
        routeRef: coreExtensionData.routeRef.optional(),
      },
      factory: () => ({
        routePath,
        routeRef: routeRef ? convertLegacyRouteRef(routeRef) : undefined,
      }),
    });

    const children = visitRouteChildren(
      node.props.children,
      name,
      createdPluginIds,
    );

    return [extension, ...children];
  });
}

/** @public */
export function collectLegacyRoutes(
  flatRoutesElement: JSX.Element,
): BackstagePlugin[] {
  const createdPluginIds = new Map<
    LegacyBackstagePlugin,
    ExtensionDefinition<unknown>[]
  >();

  React.Children.forEach(
    flatRoutesElement.props.children,
    (route: ReactNode) => {
      if (!React.isValidElement(route)) {
        return;
      }

      // TODO(freben): Handle feature flag and permissions framework wrapper elements
      if (route.type !== Route) {
        return;
      }

      const routeElement = route.props.element;

      const plugin = getComponentData<LegacyBackstagePlugin>(
        routeElement,
        'core.plugin',
      );
      if (!plugin) {
        return;
      }

      const routeRef = getComponentData<RouteRef>(
        routeElement,
        'core.mountPoint',
      );

      const detectedExtensions =
        createdPluginIds.get(plugin) ??
        new Array<ExtensionDefinition<unknown>>();
      createdPluginIds.set(plugin, detectedExtensions);

      const path: string = route.props.path;

      const name = detectedExtensions.length
        ? String(detectedExtensions.length + 1)
        : undefined;

      const childExtensions = visitRouteChildren(
        route.props.children,
        name ?? '0',
        createdPluginIds,
      );

      detectedExtensions.push(
        createPageExtension({
          name,
          defaultPath: path[0] === '/' ? path.slice(1) : path,
          routeRef: routeRef ? convertLegacyRouteRef(routeRef) : undefined,

          loader: async () =>
            route.props.children ? (
              <Routes>
                <Route path="*" element={routeElement}>
                  <Route path="*" element={route.props.children} />
                </Route>
              </Routes>
            ) : (
              routeElement
            ),
        }),
        ...childExtensions,
      );
    },
  );

  return Array.from(createdPluginIds).map(([plugin, extensions]) =>
    createPlugin({
      id: plugin.getId(),
      extensions: [
        ...extensions,
        ...Array.from(plugin.getApis()).map(factory =>
          createApiExtension({ factory }),
        ),
      ],
    }),
  );
}
