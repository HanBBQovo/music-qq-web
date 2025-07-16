import { execSync } from "child_process";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { resolve } from "path";

function getGitCommitInfo() {
  // Check if running on Vercel
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    console.log("✅ Vercel环境，使用环境变量。");
    return {
      version: process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7),
      changelog: process.env.VERCEL_GIT_COMMIT_MESSAGE || "暂无提交信息。",
    };
  }

  // Fallback to local git command
  try {
    console.log("✅ 本地环境，使用Git命令。");
    const version = execSync("git rev-parse --short HEAD").toString().trim();
    const changelog = execSync("git log -1 --pretty=%B").toString().trim();
    return { version, changelog };
  } catch (e) {
    console.warn("⚠️ 无法获取Git信息，将使用默认版本号 'development'。");
    return {
      version: "development",
      changelog: "不在Git仓库中，或Git命令执行失败。",
    };
  }
}

function updateEnvFile(version) {
  const envPath = resolve(process.cwd(), ".env.local");
  const envVar = `NEXT_PUBLIC_APP_VERSION=${version}`;

  let content = "";
  if (existsSync(envPath)) {
    content = readFileSync(envPath, "utf-8");
  }

  if (content.includes("NEXT_PUBLIC_APP_VERSION")) {
    content = content.replace(/NEXT_PUBLIC_APP_VERSION=.*/, envVar);
  } else {
    content += `\n${envVar}`;
  }

  writeFileSync(envPath, content.trim());
  console.log(`✅ .env.local 已更新/创建: ${envVar}`);
}

function run() {
  const { version, changelog } = getGitCommitInfo();

  const versionInfo = {
    version,
    changelog,
  };

  writeFileSync(
    resolve(process.cwd(), "public/version.json"),
    JSON.stringify(versionInfo, null, 2)
  );
  console.log(`✅ 版本文件已生成: public/version.json (版本: ${version})`);

  updateEnvFile(version);
}

run();
