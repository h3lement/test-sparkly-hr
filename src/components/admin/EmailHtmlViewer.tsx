import { ScrollArea } from "@/components/ui/scroll-area";

interface EmailHtmlViewerProps {
  html: string;
  heightClassName?: string;
  iframeHeight?: number;
  title?: string;
}

export function EmailHtmlViewer({
  html,
  heightClassName = "h-[320px]",
  iframeHeight = 320,
  title = "Email Preview",
}: EmailHtmlViewerProps) {
  return (
    <ScrollArea className={heightClassName}>
      <iframe
        srcDoc={html}
        className="w-full border-0"
        style={{ height: `${iframeHeight}px`, backgroundColor: "white" }}
        title={title}
        sandbox="allow-same-origin"
      />
    </ScrollArea>
  );
}
