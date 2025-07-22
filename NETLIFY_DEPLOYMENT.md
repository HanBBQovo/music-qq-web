# Netlify 部署配置

## 1. 环境变量配置

在 Netlify 项目的 **Site configuration** 或 **Site settings** → **Environment variables** 中设置：

- `NEXT_PUBLIC_API_URL` = `/music-api`
- `BACKEND_API_URL` = `你的后端服务器地址`

## 2. 重定向文件配置

复制 `public/_redirects.example` 为 `public/_redirects`，并将 `YOUR_BACKEND_URL` 替换为你的实际后端地址。

## 3. 部署步骤

1. 在 Netlify 上导入 GitHub 仓库
2. 配置环境变量（见步骤1）
3. 创建 `public/_redirects` 文件（见步骤2）
4. 触发部署

## 注意事项

- `_redirects` 文件已加入 `.gitignore`，避免敏感信息泄露
- 每次部署前需要确保 `_redirects` 文件存在且配置正确
- API 代理规则必须放在 SPA 路由规则前面