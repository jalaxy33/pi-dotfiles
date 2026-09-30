# pi-ext-manifest-fix

**English** | [简体中文](./README.zh-CN.md)

Rewrites extension manifests to clear pi's host-package warnings.

## What it does

Moves host-provided packages (`@earendil-works/pi-*`, `typebox`) from
`dependencies` to `peerDependencies: "*"`.

## Scope

Only packages under `~/.pi/agent/npm/node_modules` that declare extensions.
Nothing else is touched, nothing is hardcoded.

## Behavior

Pi reads the manifests before extensions load, so the first start after such a
package is reinstalled still warns once.
