import { Project, ts } from "ts-morph";
import path from "path";

/**
 * 扫描整个项目，找出未被任何其他文件引用的导出。
 * 仅打印报告，不做任何删除操作。
 */
(async () => {
  const project = new Project({
    tsConfigFilePath: path.resolve(__dirname, "../tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });

  // 获取所有源码文件，过滤掉 node_modules 与 .next
  const sourceFiles = project
    .getSourceFiles()
    .filter((sf: import("ts-morph").SourceFile) => {
      const filePath = sf.getFilePath();
      return !/node_modules/.test(filePath) && !/\/\.next\//.test(filePath);
    });

  // 框架及约定白名单导出名，视为已使用
  const FRAMEWORK_EXPORTS = [
    "default",
    "metadata",
    "generateStaticParams",
    "generateMetadata",
  ];

  type Unused = {
    file: string;
    exportName: string;
    kind: string;
    deletable: boolean;
  };

  const unusedList: Unused[] = [];

  for (const sourceFile of sourceFiles) {
    const exportDeclMap = sourceFile.getExportedDeclarations();
    for (const [name, declarations] of Array.from(exportDeclMap)) {
      // declarations 可能为多个（同名重导出），逐个检查
      for (const declaration of declarations) {
        // 检查是否为 default 导出，记录名称为 "default" 即可
        const exportName = name;

        // 跳过白名单导出
        if (FRAMEWORK_EXPORTS.includes(exportName)) {
          continue;
        }

        // 查找引用（包含定义本身）
        const refs = (declaration as any).findReferences();

        // 过滤掉同文件引用，统计跨文件引用数
        const allRefNodes = refs.flatMap((ref: any) => ref.getReferences());
        const crossFileRefs = allRefNodes.filter((ref: any) => {
          const refFile = ref.getSourceFile();
          return refFile !== sourceFile;
        });

        const internalRefs = allRefNodes.length - crossFileRefs.length;

        const deletable = crossFileRefs.length === 0 && internalRefs <= 1;

        if (crossFileRefs.length === 0) {
          unusedList.push({
            file: path.relative(
              project.getDirectoryOrThrow(".").getPath(),
              sourceFile.getFilePath()
            ),
            exportName,
            kind: ts.SyntaxKind[declaration.getKind()],
            deletable,
          });
        }
      }
    }
  }

  if (unusedList.length === 0) {
    console.log("\u2705 没有发现未被引用的导出，代码很干净！");
    return;
  }

  const deletableCount = unusedList.filter((u) => u.deletable).length;

  console.log(
    `\n共发现 ${unusedList.length} 个未被跨文件引用的导出，其中可删除 ${deletableCount} 个：`
  );
  console.table(unusedList);

  // 额外输出 JSON 报告，便于后续 CI 分析
  try {
    const fs = await import("fs/promises");
    await fs.writeFile(
      path.resolve(__dirname, "unused-report.json"),
      JSON.stringify(unusedList, null, 2),
      "utf8"
    );
    await fs.writeFile(
      path.resolve(__dirname, "deletable-report.json"),
      JSON.stringify(
        unusedList.filter((u) => u.deletable),
        null,
        2
      ),
      "utf8"
    );
    console.log(
      "\n已生成 JSON 报告于 scripts/unused-report.json 与 deletable-report.json\n"
    );
  } catch (err) {
    console.warn("写入 JSON 报告失败：", err);
  }
})();
