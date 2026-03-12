import type { ReactNode } from "react";

type AnalysisStudioLayoutProps = {
  toolbar: ReactNode;
  dataExplorer: ReactNode;
  canvas: ReactNode;
  copilot: ReactNode;
  results: ReactNode;
};

export function AnalysisStudioLayout(props: AnalysisStudioLayoutProps) {
  const { toolbar, dataExplorer, canvas, copilot, results } = props;

  return (
    <div className="analysisStudio">
      <header className="analysisStudio__toolbar">{toolbar}</header>

      <section className="analysisStudio__workbench">
        <aside className="analysisStudio__left">{dataExplorer}</aside>
        <main className="analysisStudio__center">{canvas}</main>
        <aside className="analysisStudio__right">{copilot}</aside>
      </section>

      <section className="analysisStudio__bottom">{results}</section>
    </div>
  );
}
