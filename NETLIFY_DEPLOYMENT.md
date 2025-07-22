# Netlify 部署配置

## 配置文件

1. 复制 `netlify.toml.example` 为 `netlify.toml`
2. 修改其中的 `YOUR_BACKEND_URL_HERE` 为你的实际后端地址

## 环境变量

在 Netlify 仪表板中设置以下环境变量：

- `NEXT_PUBLIC_API_URL` = `/music-api`
- `BACKEND_API_URL` = `你的后端服务器地址`

## 部署步骤

1. 在 Netlify 上导入 GitHub 仓库
2. 配置上述环境变量
3. 创建并配置 `netlify.toml` 文件
4. 部署