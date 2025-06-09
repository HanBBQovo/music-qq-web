import { DownloadManagerComponent } from "@/components/download/download-manager";

export default function DownloadPage() {
  return (
    <div className="layout-container">
      <div className="space-y-8 animate-slide-up py-6 md:py-8">
        <DownloadManagerComponent />
      </div>
    </div>
  );
}
