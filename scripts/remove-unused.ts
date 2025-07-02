import { Project } from "ts-morph";
import path from "path";
import fs from "fs";

/**
 * 根据 scripts/deletable-report.json 删除未使用的导出或文件。
 * ⚠️ 操作不可逆，请确保已提交快照！
 */
(async () => {
  const reportPath = path.resolve(__dirname, "deletable-report.json");
  if (!fs.existsSync(reportPath)) {
    console.error("未找到 deletable-report.json，请先运行 npm run find-unused");
    process.exit(1);
  }

  const report: Array<{
    file: string;
    exportName: string;
    kind: string;
    deletable: boolean;
  }> = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

  // 按文件分组
  const group = new Map<string, string[]>();
  for (const item of report) {
    if (!item.deletable) continue;
    const arr = group.get(item.file) ?? [];
    arr.push(item.exportName);
    group.set(item.file, arr);
  }

  if (group.size === 0) {
    console.log("\u2705 无可删除导出，跳过删除操作");
    return;
  }

  const project = new Project({
    tsConfigFilePath: path.resolve(__dirname, "../tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });

  const deletedFiles: string[] = [];
  const deletedExports: Array<{ file: string; name: string }> = [];

  for (const [relativeFile, names] of Array.from(group.entries())) {
    const absPath = path.resolve(
      project.getDirectoryOrThrow(".").getPath(),
      relativeFile
    );
    const sourceFile = project.getSourceFile(absPath);
    if (!sourceFile) continue;

    // 如果所有导出都将被删除，则直接删除文件
    const existingExports = sourceFile.getExportedDeclarations();
    const exportKeys = Array.from(existingExports.keys());
    const willDeleteAll = names.length === exportKeys.length;

    if (willDeleteAll) {
      sourceFile.delete();
      deletedFiles.push(relativeFile);
      continue;
    }

    // 否则逐个删除导出
    for (const name of names) {
      const decls = existingExports.get(name);
      if (!decls) continue;
      for (const decl of decls) {
        try {
          (decl as any).remove();
          deletedExports.push({ file: relativeFile, name });
        } catch (e) {
          console.warn(`无法删除 ${relativeFile} 中导出 ${name}:`, e);
        }
      }
    }
  }

  // 保存修改
  await project.save();

  console.log("\n删除完成：");
  console.table({
    filesDeleted: deletedFiles.length,
    exportsDeleted: deletedExports.length,
  });
})();
