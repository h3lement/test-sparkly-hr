import { CTATemplateManager } from "./CTATemplateManager";

export function TemplateVersionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">CTA Templates</h2>
        <p className="text-muted-foreground">
          Manage call-to-action templates for quizzes
        </p>
      </div>

      <CTATemplateManager />
    </div>
  );
}
