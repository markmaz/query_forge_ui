import type { WorkflowPaletteDoc } from "../model/workflowPaletteDocs";
import Icon from "@/shared/components/Icon";

interface WorkflowPaletteHelpDrawerProps {
  doc: WorkflowPaletteDoc;
  onClose: () => void;
}

export default function WorkflowPaletteHelpDrawer({
  doc,
  onClose,
}: WorkflowPaletteHelpDrawerProps) {
  return (
    <section className="ff-palette-help-drawer" role="complementary" aria-label={`${doc.title} guide`}>
      <div className="ff-palette-help-header">
        <div>
          <div className="ff-eyebrow">Workflow Guide</div>
          <h3>{doc.title}</h3>
        </div>
        <button type="button" className="ff-palette-help-close" onClick={onClose} aria-label="Close workflow guide">
          <Icon provider="fa" pack="solid" name="xmark" size={14} />
        </button>
      </div>

      <div className="ff-palette-help-banner">
        <span aria-hidden="true">
          <Icon provider="fa" pack="solid" name="lightbulb" size={15} />
        </span>
        <p>{doc.summary}</p>
      </div>

      <div className="ff-palette-help-section">
        <h4>Good Uses</h4>
        <ul>
          {doc.bestFor.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="ff-palette-help-grid">
        <div className="ff-palette-help-section">
          <h4>What It Needs</h4>
          <dl>
            {doc.inputs.map((input) => (
              <div key={input.label}>
                <dt>{input.label}</dt>
                <dd>{input.description}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="ff-palette-help-section">
          <h4>What It Passes On</h4>
          <dl>
            {doc.outputs.map((output) => (
              <div key={output.label}>
                <dt>{output.label}</dt>
                <dd>{output.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="ff-palette-help-section">
        <h4>Examples</h4>
        <div className="ff-palette-help-examples">
          {doc.examples.map((example) => (
            <article key={example.title}>
              <strong>{example.title}</strong>
              <p>{example.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="ff-palette-help-section ff-palette-help-tips">
        <h4>Helpful Notes</h4>
        <ul>
          {doc.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
