# Archived Postmortem: YouTube 字幕抓取返回空内容问题

This document is kept as a historical record from 2026-03-01.
It reflects the implementation and debugging context at that time and is not intended to describe the current architecture in detail.

**日期**: 2026-03-01
**状态**: 已修复
**影响范围**: 所有视频的字幕段落获取功能完全失效

---

## 问题现象

用户导入 YouTube 视频后，字幕元数据（轨道列表）能正常获取，但实际字幕内容始终为空。

具体表现：

- 元数据请求成功，能发现 7 条字幕轨道
- 所有字幕 URL 请求均返回 HTTP 200，但 **响应体为空**（`payloadLength: 0`）
- 尝试了 7 种格式变体（json3、vtt、ttml、srv3、srv1 等），全部返回空内容

## 根因分析

### YouTube 的变化

YouTube 的字幕 API (`/api/timedtext`) 会根据请求来源的客户端类型生成不同的 `baseURL`。关键区别在于：

| 客户端类型        | 生成的 URL 特征    | 服务端请求是否可用 |
| ----------------- | ------------------ | ------------------ |
| WEB（网页端）     | 包含网页端签名参数 | 不再可用           |
| ANDROID（安卓端） | 包含移动端签名参数 | 仍然可用           |

YouTube 在某个时间点修改了策略，**网页端客户端生成的字幕 URL 不再向服务端请求提供内容**。这意味着即使 URL 有效、HTTP 状态码为 200，响应体也是空的。

### 当时代码中的问题

代码中实际上已经实现了三种获取字幕元数据的策略：

```text
Strategy 1 (主策略): HTML 解析 → 从网页 ytInitialPlayerResponse 提取
Strategy 2 (备选):   Innertube + API Key → 使用 WEB 客户端
Strategy 3 (末选):   Innertube Direct → 使用 ANDROID 客户端
```

问题出在：

1. **策略优先级错误** — Strategy 1（HTML 解析）总是成功，产出的是 WEB 客户端的字幕 URL。Strategy 3（ANDROID 客户端，能产出可用 URL）作为最后的 fallback 永远不会执行。
2. **Strategy 2 也用了错误的客户端** — `fetchInnertubePlayerWithKey()` 使用的是 `clientName: "WEB"`，即使作为备选被触发，产出的 URL 同样不可用。
3. **候选 URL 过多** — `buildCandidateUrls()` 生成了多种格式变体，但问题核心不在格式，而在 URL 来源本身。

### 对照成熟方案

Python 的 `youtube-transcript-api` 和 Node.js 的 `youtube-transcript-plus` 这两个当时仍正常工作的库，它们的做法是：

- 使用 **ANDROID Innertube 客户端**（`clientName: "ANDROID"`, `clientVersion: "20.10.38"`）
- 优先获取默认 XML，而不是广泛尝试格式变体
- 减少无意义的候选 URL 扩散

## 修复方案

### 文件 1: `src/server/youtube/service.ts`

**a) 重排策略优先级：**

```text
Strategy 1 (主策略): Innertube Direct → ANDROID 客户端（产出可用 URL）
Strategy 2 (备选):   HTML 解析 → 从网页提取（fallback）
Strategy 3 (末选):   Innertube + API Key（最终 fallback）
```

**b) 精简候选 URL 生成：**

```text
之前: 多种格式候选 URL
之后: 以默认 XML 为主，保留少量 fallback
```

### 文件 2: `src/server/youtube/watchPage.ts`

统一使用 ANDROID Innertube 客户端参数，确保 Innertube 路径产出的字幕 URL 在服务端可用。

## 当时的验证方式

1. `npm run typecheck`
2. 导入 YouTube 视频，确认字幕段落正常加载
3. 检查日志，确认 ANDROID 路径被优先使用
4. 确认响应体长度大于 0

## 经验总结

1. **Fallback 排序比“有没有 fallback”更重要**。
2. **YouTube 会基于客户端类型返回不同可用性的字幕 URL**。
3. **对照仍在工作的成熟开源实现，能快速缩小排查范围**。
