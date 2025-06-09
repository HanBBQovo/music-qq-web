import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { ParseResultContent } from "@/components/parse/parse-result-content";

export default function ParseResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="layout-container">
      <div className="space-y-6 py-6 md:py-8">
        {/* 页面头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                返回搜索
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">链接解析结果</h1>
              <p className="text-muted-foreground">解析的音乐内容</p>
            </div>
          </div>
        </div>

        {/* 解析结果内容 */}
        <Suspense
          fallback={
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">正在加载解析结果...</p>
                </div>
              </CardContent>
            </Card>
          }
        >
          <ParseResultContentWrapper params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function ParseResultContentWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  return <ParseResultContent parseId={resolvedParams.id} />;
}
