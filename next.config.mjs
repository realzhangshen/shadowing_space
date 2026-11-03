import withSerwistInit from "@serwist/next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// 2026-11-03：在 img-src / connect-src 放行 YouTube 缩略图域（*.ytimg.com）。
// 范围：所有路由（经下方 headers 统一设置）。用途：PWA Service Worker 的 fetch
// 受该 CSP 约束；Serwist 的图片缓存规则曾拦截跨域 i.ytimg.com 缩略图，导致
// SW 内 fetch 报 ERR_FAILED、仪表盘图片全部加载失败。现在运行缓存已限制为同源，
// 这里同时覆盖浏览器层面的图片加载/重定向。来源：排查 shadowing.space 仪表盘
// 缩略图问题（对应本次 Codex 复核提交）。
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com https://*.ytimg.com",
  "font-src 'self'",
  "connect-src 'self' https://www.youtube.com https://*.ytimg.com https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: cspDirectives.join("; "),
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: "microphone=(self), camera=(), geolocation=()",
        },
      ],
    },
  ],
};

export default withSerwist(withNextIntl(nextConfig));
