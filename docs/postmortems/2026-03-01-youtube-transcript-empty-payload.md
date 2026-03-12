# YouTube 字幕抓取返回空内容问题报告

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

### 我们代码中的问题

代码中实际上已经实现了三种获取字幕元数据的策略：

```
Strategy 1 (主策略): HTML 解析 → 从网页 ytInitialPlayerResponse 提取
Strategy 2 (备选):   Innertube + API Key → 使用 WEB 客户端
Strategy 3 (末选):   Innertube Direct → 使用 ANDROID 客户端
```

问题出在：

1. **策略优先级错误** — Strategy 1（HTML 解析）总是成功，产出的是 WEB 客户端的字幕 URL。Strategy 3（ANDROID 客户端，能产出可用 URL）作为最后的 fallback 永远不会执行。

2. **Strategy 2 也用了错误的客户端** — `fetchInnertubePlayerWithKey()` 使用的是 `clientName: "WEB"`，即使作为备选被触发，产出的 URL 同样不可用。

3. **候选 URL 过多** — `buildCandidateUrls()` 生成了 7 个格式变体，但问题不在格式而在 URL 本身。成熟的开源库（如 `youtube-transcript-api`、`youtube-transcript-plus`）只需要去掉 `fmt` 参数获取默认 XML 即可。

### 对照成熟方案

Python 的 `youtube-transcript-api` 和 Node.js 的 `youtube-transcript-plus` 这两个至今仍正常工作的库，它们的做法是：

- 使用 **ANDROID Innertube 客户端**（`clientName: "ANDROID"`, `clientVersion: "20.10.38"`）
- **去掉 `fmt` 参数**，直接获取默认 XML 格式
- 不尝试多种格式变体

## 修复方案

### 文件 1: `src/server/youtube/service.ts`

**a) 重排策略优先级：**

```
Strategy 1 (主策略): Innertube Direct → ANDROID 客户端（产出可用 URL）
Strategy 2 (备选):   HTML 解析 → 从网页提取（fallback）
Strategy 3 (末选):   Innertube + API Key（最终 fallback）
```

将 ANDROID Innertube 从最后的 fallback 提升为首选策略，确保优先获取可用的字幕 URL。

**b) 精简候选 URL 生成：**

```
之前: 7 个候选 URL（原始 URL + 5 种 fmt 变体 + 无 fmt）
之后: 2-3 个候选 URL（无 fmt 默认 XML → fmt=json3 → 原始 URL）
```

### 文件 2: `src/server/youtube/watchPage.ts`

**修复 `fetchInnertubePlayerWithKey()` 的客户端参数：**

```
之前: clientName: "WEB",     clientVersion: "2.20240101.00.00"
之后: clientName: "ANDROID", clientVersion: "20.10.38"
```

确保所有 Innertube 策略都使用 ANDROID 客户端，无论哪个策略被触发，产出的字幕 URL 都是可用的。

### 无需修改的文件

- `segments.ts` — XML `<text start="..." dur="...">` 解析逻辑不受影响
- `trackToken.ts` — 主机白名单和路径验证已兼容
- `http.ts`、`errors.ts`、API 路由、类型定义 — 无需变更

## 验证方式

1. `npm run typecheck` — 类型检查通过
2. 运行应用，导入 YouTube 视频，确认字幕段落正常加载
3. 检查日志，确认 `strategy: "innertube_direct"` 被选中（ANDROID 路径）
4. 确认日志中 `payloadLength > 0`（响应体非空）

## 经验总结

1. **Fallback 策略的排序至关重要** — 最可靠的策略应该放在最前面，而不是最后面。当主策略"看起来成功"（返回了数据）但实际无效时，后面的 fallback 永远不会被触发。

2. **YouTube API 的客户端差异化行为** — YouTube 会根据客户端类型返回不同行为的 URL。ANDROID 客户端目前是服务端抓取最稳定的选择，这也是主流开源库的共同选择。

3. **参考成熟实现** — 当自研方案出问题时，对照仍在正常工作的开源库（如 `youtube-transcript-api`）可以快速定位差异点。
