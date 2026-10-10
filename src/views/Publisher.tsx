import { GlassPanel, PanelHeader } from "@/components/ui/GlassPanel";
import { VideoDropzone } from "@/components/publisher/VideoDropzone";
import { PlatformSelector } from "@/components/publisher/PlatformSelector";
import { PreviewStage } from "@/components/publisher/PreviewStage";
import { AIAssistant } from "@/components/publisher/AIAssistant";
import { Composer } from "@/components/publisher/Composer";
import { PublishActions } from "@/components/publisher/PublishActions";
import { UploadQueue } from "@/components/publisher/UploadQueue";

export function Publisher() {
  return (
    <div className="grid min-h-full grid-cols-[minmax(0,1fr)_400px] gap-5">
      <div className="flex min-w-0 flex-col gap-5">
        <GlassPanel accent className="space-y-5 pb-5">
          <PanelHeader title="New post" hint="Upload once. Each platform gets a cut in its own format." />
          <div className="space-y-5 px-5">
            <VideoDropzone />
            <PlatformSelector />
          </div>
        </GlassPanel>

        <GlassPanel className="flex-1 pb-5">
          <PanelHeader title="Preview" hint="Exactly how each platform will frame it. Change the fit per platform." />
          <div className="px-5 pt-5">
            <PreviewStage />
          </div>
        </GlassPanel>
      </div>

      <div className="flex flex-col gap-5">
        <GlassPanel className="space-y-4 pb-5">
          <PanelHeader title="Copy assistant" hint="Describe the video, get titles, a caption and hashtags." />
          <div className="space-y-5 px-5">
            <AIAssistant />
            <div className="h-px bg-line" />
            <Composer />
            <PublishActions />
          </div>
        </GlassPanel>

        <GlassPanel className="pb-4">
          <PanelHeader title="Upload queue" />
          <div className="px-4 pt-3">
            <UploadQueue />
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
