# Netlify 部署配置

## 环境变量配置

在 Netlify 项目的 **Site configuration** 或 **Site settings** → **Environment variables** 中设置：

- `NEXT_PUBLIC_API_URL` = `/music-api`
- `BACKEND_API_URL` = `你的后端服务器地址`

## 部署说明

1. 在 Netlify 上导入 GitHub 仓库
2. 配置上述环境变量
3. 部署时，构建命令会自动将 `public/_redirects` 文件中的 `BACKEND_URL_PLACEHOLDER` 替换为 `BACKEND_API_URL` 环境变量的值
4. 触发部署

## 工作原理

- `public/_redirects` 文件使用占位符 `BACKEND_URL_PLACEHOLDER`，可以安全地提交到 Git
- 构建时通过 `sed` 命令将占位符替换为 `BACKEND_API_URL` 环境变量的值
- 这样既避免了敏感信息泄露，又让 Netlify 能正确读取配置