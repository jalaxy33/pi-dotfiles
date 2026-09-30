# pi-ext-manifest-fix

[English](./README.md) | **简体中文**

自动修正扩展清单，消除 pi 的宿主包告警。

## 做什么

把 `@earendil-works/pi-*`、`typebox` 这类宿主提供的包从 `dependencies` 移到
`peerDependencies: "*"`。

## 范围

只处理 `~/.pi/agent/npm/node_modules` 下声明了扩展的包。别处不动，也没有写死的名字。

## 行为

pi 在加载扩展之前就读这些清单，所以这类包刚被重装后的第一次启动仍会告警一次。
