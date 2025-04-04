/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-04-03 16:08:08
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-04-04 17:47:57
 * @FilePath: /pandoraproxy/app.js
 * @Description:
 *
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved.
 */

const express = require("express");
const proxy = require("express-http-proxy");
const basicAuth = require("basic-auth");
const app = express();

// 配置代理服务器的认证信息
const PROXY_USERNAME = process.env.PROXY_USERNAME || "admin";
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || "admin";

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// 认证中间件
const auth = (req, res, next) => {
  // 获取客户端IP地址
  const clientIP = req.ip || req.connection.remoteAddress;
  const forwardedIP = req.headers["x-forwarded-for"] || "";

  // 打印客户端IP信息
  console.log(
    JSON.stringify(
      {
        clientIP: clientIP,
        forwardedIP: forwardedIP,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );

  // 尝试从基本认证头获取凭据
  const credentials = basicAuth(req);

  // 尝试从代理认证信息获取凭据（适用于axios的proxy配置）
  const proxyAuth = req.headers["proxy-authorization"];
  let proxyCredentials = null;

  if (proxyAuth && proxyAuth.startsWith("Basic ")) {
    const base64Credentials = proxyAuth.split(" ")[1];
    const decodedCredentials = Buffer.from(
      base64Credentials,
      "base64"
    ).toString("utf-8");
    const [name, pass] = decodedCredentials.split(":");
    if (name && pass) {
      proxyCredentials = { name, pass };
    }
  }

  // 检查是否有任一认证方式符合要求
  if (
    (!credentials ||
      credentials.name !== PROXY_USERNAME ||
      credentials.pass !== PROXY_PASSWORD) &&
    (!proxyCredentials ||
      proxyCredentials.name !== PROXY_USERNAME ||
      proxyCredentials.pass !== PROXY_PASSWORD)
  ) {
    res.set("WWW-Authenticate", 'Basic realm="Proxy Authentication Required"');
    return res.status(401).send("Authentication required");
  }

  next();
};

// 代理中间件
app.use(
  "/",
  auth,
  proxy(
    (req) => {
      // 从host头部获取目标URL
      const host = req.headers.host;
      // 检查是否是直接访问代理服务器本身
      if (
        host &&
        !host.includes("localhost") &&
        !host.includes("127.0.0.1") &&
        !host.includes(`:${PORT}`)
      ) {
        const protocol = req.secure ? "https" : "http";
        return `${protocol}://${host}`;
      }
    },

    {
      // https: true,
      // 代理配置选项
      proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        // 可以在这里修改代理请求的选项
        // 例如，移除我们不需要的头部
        delete proxyReqOpts.headers["proxy-authorization"];
        return proxyReqOpts;
      },
      proxyReqPathResolver: (req) => {
        // 否则直接使用原始请求的路径和查询参数
        return req.url;
      },
      userResHeaderDecorator: (
        headers,
        userReq,
        userRes,
        proxyReq,
        proxyRes
      ) => {
        // 可以在这里修改响应头
        return headers;
      },
      // 处理错误
      proxyErrorHandler: (err, res, next) => {
        console.error("Proxy error:", err);
        res.status(500).send("Proxy error occurred");
      },
    }
  )
);

// 健康检查端点
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Proxy server running on port ${PORT}`);
});
