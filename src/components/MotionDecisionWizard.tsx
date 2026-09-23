import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  decisionTree,
  nextStep,
  riskLevelColor,
  START_NODE_ID,
  type LeafNode,
} from "../../lib/motionAiDecisionTree";

type Answers = Record<string, string>;

type Option = { value: string; label: string };

type Question = {
  id: string;
  section: string;
  prompt: string;
  helper?: string;
  options: Option[];
  /** Only shown when this returns true (or is omitted). Evaluated against answers so far. */
  showIf?: (answers: Answers) => boolean;
};

const questions: Question[] = [
  {
    id: "legalAnalysis",
    section: "Motion and task",
    prompt: "Does this need legal analysis or citations?",
    helper: "Substantive work includes motions to dismiss, summary judgment, motions in limine, and injunctions.",
    options: [
      { value: "no", label: "No — routine or admin" },
      { value: "yes", label: "Yes — substantive argument" },
    ],
  },
  {
    id: "motionType",
    section: "Motion and task",
    prompt: "What type of motion is this?",
    helper: "Examples: extension, compel discovery, dismissal, TRO.",
    showIf: (a) => a.legalAnalysis === "yes",
    options: [
      { value: "discovery", label: "Discovery / evidentiary" },
      { value: "dispositive", label: "Dispositive" },
      { value: "emergency", label: "Emergency / injunctive" },
      { value: "other", label: "Other substantive" },
    ],
  },
  {
    id: "taskScope",
    section: "Motion and task",
    prompt: "What would you ask AI to do?",
    helper: "Outlining is lower-risk than generating filing-ready argument.",
    showIf: (a) => a.legalAnalysis === "yes",
    options: [
      { value: "bounded", label: "Outline / organize / summarize" },
      { value: "substantive", label: "Generate substantive argument" },
    ],
  },
  {
    id: "confidentialInfo",
    section: "Confidentiality and vendor",
    prompt: "Any confidential client info involved?",
    helper: "Think privilege, work product, personal data, sealed facts.",
    showIf: (a) => a.legalAnalysis === "no",
    options: [
      { value: "no", label: "No" },
      { value: "yes", label: "Yes" },
    ],
  },
  {
    id: "dataAgreement",
    section: "Confidentiality and vendor",
    prompt: "Does your vendor agreement cover confidentiality?",
    helper: "Look for no training on inputs, retention limits, encryption.",
    showIf: (a) => a.legalAnalysis === "no" && a.confidentialInfo === "yes",
    options: [
      { value: "yes", label: "Yes, reviewed" },
      { value: "no", label: "No / not sure" },
    ],
  },
  {
    id: "toolGrounding",
    section: "Accuracy and reliability",
    prompt: "Is the tool citation-verified, not just a general LLM?",
    helper: "E.g., Westlaw CoCounsel or Lexis+ AI vs. a general-purpose chatbot.",
    showIf: (a) => a.legalAnalysis === "yes",
    options: [
      { value: "yes", label: "Yes — legal-specific" },
      { value: "no", label: "No — general LLM" },
    ],
  },
  {
    id: "stakes",
    section: "Accuracy and reliability",
    prompt: "What's at stake if this motion is wrong?",
    helper: "High: dispositive, emergency, or case-changing motions.",
    showIf: (a) => a.legalAnalysis === "yes",
    options: [
      { value: "low", label: "Lower / routine" },
      { value: "high", label: "High / case-changing" },
    ],
  },
  {
    id: "jurisdictionSpecificity",
    section: "Accuracy and reliability",
    prompt: "Does it reflect your jurisdiction and judge's preferences?",
    showIf: (a) => a.legalAnalysis === "yes",
    options: [
      { value: "yes", label: "Yes, current & specific" },
      { value: "no", label: "No / not sure" },
    ],
  },
  {
    id: "verificationCapacity",
    section: "Professional responsibility",
    prompt: "Can you verify every citation before filing?",
    helper: "The duty to verify doesn't move to the tool.",
    showIf: (a) => a.legalAnalysis === "yes" && a.stakes === "low",
    options: [
      { value: "yes", label: "Yes, time & expertise available" },
      { value: "no", label: "No — unrealistic deadline/staffing" },
    ],
  },
  {
    id: "disclosure",
    section: "Court and ethics rules",
    prompt: "Checked current AI disclosure rules for this judge?",
    helper: "Standing orders on AI use change often — check the latest.",
    showIf: (a) => a.legalAnalysis === "yes" && a.stakes === "high",
    options: [
      { value: "yes", label: "Yes / none required" },
      { value: "no", label: "No / unclear" },
    ],
  },
  {
    id: "competence",
    section: "Court and ethics rules",
    prompt: "Can you competently supervise this tool's output?",
    helper: "Model Rule 1.1, ABA Formal Opinion 512, Rules 1.6 and 3.3.",
    showIf: (a) => a.legalAnalysis === "yes",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No / not sure" },
    ],
  },
  {
    id: "operations",
    section: "Firm operations and exposure",
    prompt: "Worth the cost, time, and learning curve?",
    showIf: (a) => a.legalAnalysis === "yes",
    options: [
      { value: "yes", label: "Yes, clear benefit" },
      { value: "no", label: "No / not yet" },
    ],
  },
  {
    id: "liability",
    section: "Firm operations and exposure",
    prompt: "Considered malpractice and billing implications?",
    helper: "Check coverage for AI errors and client/billing disclosure needs.",
    showIf: (a) => a.legalAnalysis === "yes",
    options: [
      { value: "yes", label: "Yes, addressed" },
      { value: "no", label: "No / not sure" },
    ],
  },
];

const riskLabels = {
  GREEN: "Lower risk",
  YELLOW: "Caution",
  YELLOW_PLUS: "Elevated caution",
  RED: "High risk",
} as const;

export function MotionDecisionWizard() {
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<LeafNode | null>(null);

  // Only the questions that apply given answers so far, in order.
  const visibleQuestions = useMemo(
    () => questions.filter((q) => !q.showIf || q.showIf(answers)),
    [answers],
  );

  const currentQuestion = visibleQuestions.find((q) => !(q.id in answers)) ?? null;
  const answeredCount = visibleQuestions.filter((q) => q.id in answers).length;
  const totalCount = visibleQuestions.length;
  const progressPct = totalCount === 0 ? 0 : Math.round((answeredCount / totalCount) * 100);

  function selectAnswer(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setResult(null);
  }

  function goBack() {
    setResult(null);
    for (let i = visibleQuestions.length - 1; i >= 0; i--) {
      const id = visibleQuestions[i].id;
      if (id in answers) {
        setAnswers((current) => {
          const copy = { ...current };
          delete copy[id];
          return copy;
        });
        return;
      }
    }
  }

  function calculateRecommendation() {
    let nodeId = START_NODE_ID;
    const treeLabels = answers.legalAnalysis === "yes"
      ? [
          "Yes — substantive legal argument",
          answers.toolGrounding === "yes" ? "Yes" : "No / general-purpose LLM",
          answers.stakes === "high" ? "High stakes / dispositive" : "Lower stakes / routine substantive",
          answers.stakes === "high"
            ? (answers.disclosure === "yes" ? "Yes" : "No / unclear")
            : (answers.verificationCapacity === "yes" ? "Yes" : "No"),
        ]
      : [
          "No — routine/administrative",
          answers.confidentialInfo === "yes" ? "Yes" : "No",
          ...(answers.confidentialInfo === "yes"
            ? [answers.dataAgreement === "yes" ? "Yes" : "No / not sure"]
            : []),
        ];

    for (const label of treeLabels) {
      nodeId = nextStep(nodeId, label).id;
    }

    const current = decisionTree[nodeId];
    if (current.type === "leaf") {
      setResult(current);
      document.getElementById("readout")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function restart() {
    setAnswers({});
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="shell">
      <header>
        <div className="brand"><span className="mark">✦</span> Motion / AI advisor</div>
        <div className="utility">A practical decision tool for legal teams</div>
      </header>

      <section className="hero">
        <h1>Should AI help write your <em>motion?</em></h1>
        <p className="intro">
          Answer a few quick questions. We'll only ask what's relevant to your situation.
        </p>
      </section>

      <div className="workspace">
        <section className="form-panel">
          {!result && (
            <>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="progress-label">
                {currentQuestion ? `Question ${answeredCount + 1} of ${totalCount}` : "Review your answers"}
              </div>
            </>
          )}

          {currentQuestion && (
            <div className="step" key={currentQuestion.id}>
              <div className="eyebrow">{currentQuestion.section}</div>
              <h2>{currentQuestion.prompt}</h2>
              {currentQuestion.helper && <p className="hint">{currentQuestion.helper}</p>}
              <div className="options chip-grid">
                {currentQuestion.options.map((option) => (
                  <button
                    className="option chip"
                    key={option.value}
                    onClick={() => selectAnswer(currentQuestion.id, option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {answeredCount > 0 && (
                <button className="back-link" onClick={goBack} type="button">← Back</button>
              )}
            </div>
          )}

          {!currentQuestion && !result && (
            <div className="step">
              <div className="eyebrow">Almost done</div>
              <h2>Here's what you told us.</h2>
              <div className="review-chips">
                {visibleQuestions.map((q) => (
                  <div className="review-chip" key={q.id}>
                    <span className="review-chip-q">{q.prompt}</span>
                    <span className="review-chip-a">
                      {q.options.find((o) => o.value === answers[q.id])?.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="submit-row">
                <button className="primary-button" onClick={calculateRecommendation} type="button">
                  See my recommendation <span aria-hidden="true">→</span>
                </button>
                <button className="back-link" onClick={goBack} type="button">← Back</button>
              </div>
            </div>
          )}

          {result && <Result result={result} answers={answers} onRestart={restart} />}
        </section>

        <aside className="aside">
          <h3>What we're weighing</h3>
          <p>AI does not take responsibility for a filing. The firm must keep judgment, supervision, and verification in the workflow.</p>
          {[
            ["Motion and task", "Routine boilerplate is different from citation-heavy, dispositive, or emergency argument."],
            ["Accuracy and reliability", "Hallucinations can create plausible but nonexistent citations, quotes, or holdings. Mata v. Avianca is a well-known sanctions example."],
            ["Tool and jurisdiction", "Consider legal-database grounding, local rules, recent authority, practice area, and judge-specific preferences."],
            ["Ethics and confidentiality", "Think about competence (Model Rule 1.1 / ABA Formal Opinion 512), confidentiality (Rule 1.6), and candor (Rule 3.3)."],
            ["Court rules", "Check current standing orders and disclosure or certification requirements; do not hard-code assumptions."],
            ["Operations and exposure", "Weigh cost, ROI, integrations, learning curve, solo review capacity, malpractice coverage, billing, and client communication."],
          ].map(([title, detail], index) => (
            <div className="signal" key={title}>
              <span className={`dot ${index > 3 ? "green" : ""}`} />
              <span><b>{title}</b><br />{detail}</span>
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}

function Result({ result, answers, onRestart }: { result: LeafNode; answers: Answers; onRestart: () => void }) {
  const color = riskLevelColor(result.riskLevel);
  const posture = result.riskLevel === "GREEN"
    ? "Use AI for bounded drafting support with ordinary attorney review."
    : result.riskLevel === "RED"
      ? "Keep substantive drafting human-led unless the safeguards below are in place."
      : "Use AI only with enhanced safeguards and full independent verification.";
  // Only warn about a factor if the question was actually asked (answers[key] exists).
  const extraActions = [
    answers.jurisdictionSpecificity && answers.jurisdictionSpecificity !== "yes" && "Confirm the tool reflects current local rules, practice-area authority, and judge-specific preferences.",
    answers.disclosure && answers.disclosure !== "yes" && "Check the current judge and jurisdiction rules for AI disclosure or certification before filing.",
    answers.competence && answers.competence !== "yes" && "Do not proceed until the responsible attorney can competently supervise the tool and its limitations.",
    answers.taskScope === "substantive" && "Treat generated legal argument as untrusted draft text and independently verify every claim.",
    answers.operations && answers.operations !== "yes" && "Confirm the expected time savings and workflow integration justify the firm's cost and learning investment.",
    answers.liability && answers.liability !== "yes" && "Ask the malpractice carrier and review client/billing agreements for AI-related requirements.",
  ].filter((action): action is string => Boolean(action));

  function downloadPlan() {
    const pdf = new jsPDF();
    const margin = 18;
    const width = 174;
    let y = 20;
    const addText = (text: string, size = 10, bold = false) => {
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(text, width);
      pdf.text(lines, margin, y);
      y += lines.length * (size * 0.48) + 5;
      if (y > 274) {
        pdf.addPage();
        y = 20;
      }
    };
    const addList = (items: string[]) => items.forEach((item) => addText(`• ${item}`));

    addText("Motion AI Use Plan", 20, true);
    addText(`Risk level: ${riskLabels[result.riskLevel]}`, 12, true);
    addText(posture);
    addText("Approved uses", 14, true);
    addList(result.riskLevel === "RED"
      ? ["Create a neutral outline from attorney notes.", "Organize a checklist or summarize attorney-verified materials.", "Improve grammar or formatting without changing legal meaning."]
      : ["Create an outline from attorney-provided headings.", "Organize notes, discovery, or a verification checklist.", "Improve grammar, clarity, and neutral phrasing.", "Summarize authorities that the attorney has already verified."]);
    addText("Do not delegate", 14, true);
    addList(["Legal strategy or selection of authorities.", "Facts, citations, quotations, or holdings without independent verification.", "Final filing approval or decisions about confidential information."]);
    addText("Suggested workflow", 14, true);
    addList(["Prepare: confirm the approved tool, data terms, and current court rules.", "Constrain: provide only the permitted task and attorney-controlled facts.", "Generate: request an outline, checklist, summary, or limited draft.", "Verify: check every citation, quotation, fact, and legal proposition against trusted sources.", "Review and file: complete attorney review and any required disclosure or certification."]);
    addText("Prompt template", 14, true);
    addText("You are assisting with organization and editing only. Use only the facts and authorities I provide. Do not invent facts, citations, quotations, or legal propositions. Flag missing information and uncertainty. Do not make strategic legal decisions. Return a structured outline and a list of items requiring attorney verification.");
    addText("Verification checklist", 14, true);
    addList(["Every citation was independently located and reviewed.", "Every quotation matches the source.", "Every factual statement matches the record.", "Current local rules and AI standing orders were checked.", "A qualified attorney approved the final filing."]);
    addText("Reassess if", 14, true);
    addList(["The motion becomes dispositive or emergency.", "New confidential or privileged material is added.", "There is no longer enough time for full verification.", "The judge or jurisdiction issues a new AI requirement."]);
    addText("Disclaimer: This is an internal risk-triage framework, not legal advice. The firm remains responsible for compliance, supervision, verification, and filing decisions.");
    pdf.save("motion-ai-use-plan.pdf");
  }

  return (
    <section className="result" id="readout" aria-live="polite">
      <div className="eyebrow">Your readout</div>
      <div className="risk-badge" style={{ color, borderColor: color }}>
        <span className="risk-dot" style={{ backgroundColor: color }} /> {riskLabels[result.riskLevel]}
      </div>
      <h2>Here&apos;s the safest way to use AI.</h2>
      <p className="recommendation-copy">{result.recommendation}</p>
      <div className="result-box">
        <h3>Before you rely on the output</h3>
        <ul>
          {[...result.requiredActions, ...extraActions].map((action) => <li key={action}>{action}</li>)}
        </ul>
      </div>
      <details className="answers">
        <summary>Review your answers</summary>
        <ol>{Object.values(answers).map((answer, index) => <li key={`${index}-${answer}`}>{answer}</li>)}</ol>
      </details>
      <button className="primary-button" onClick={onRestart} type="button">Start over</button>
      <button className="secondary-button" onClick={downloadPlan} type="button">Download AI use plan (PDF)</button>
    </section>
  );
}
