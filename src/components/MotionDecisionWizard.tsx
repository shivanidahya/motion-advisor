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

type Question = {
  id: string;
  section: string;
  prompt: string;
  helper?: string;
  options: { value: string; label: string }[];
};

const questions: Question[] = [
  {
    id: "legalAnalysis",
    section: "Motion and task",
    prompt: "Does this motion require legal analysis or citation of case law or statutes?",
    helper: "Examples of substantive work include motions to dismiss, summary judgment, motions in limine, and injunctions.",
    options: [
      { value: "no", label: "No — routine or administrative" },
      { value: "yes", label: "Yes — substantive legal argument" },
    ],
  },
  {
    id: "motionType",
    section: "Motion and task",
    prompt: "What type of motion are you preparing?",
    options: [
      { value: "routine", label: "Routine or procedural (extension, scheduling, appearance)" },
      { value: "discovery", label: "Discovery or evidentiary (compel, protective order, motion in limine)" },
      { value: "dispositive", label: "Dispositive (dismissal or summary judgment)" },
      { value: "emergency", label: "Emergency or injunctive relief" },
      { value: "other", label: "Other substantive motion" },
    ],
  },
  {
    id: "taskScope",
    section: "Motion and task",
    prompt: "What would you ask AI to do?",
    helper: "Lower-risk uses include first-draft boilerplate, organizing discovery, and summarizing attorney-provided material. Higher-risk uses include citation-heavy argument or filing-ready text.",
    options: [
      { value: "bounded", label: "Outline, organize notes, summarize, or improve phrasing" },
      { value: "substantive", label: "Generate substantive legal argument or filing-ready language" },
    ],
  },
  {
    id: "confidentialInfo",
    section: "Confidentiality and vendor",
    prompt: "Will confidential client information enter the AI tool?",
    helper: "Consider privilege, work product, personal data, trade secrets, sealed facts, and client-identifying information.",
    options: [
      { value: "no", label: "No — information is public, redacted, or non-sensitive" },
      { value: "yes", label: "Yes — confidential or restricted information" },
    ],
  },
  {
    id: "dataAgreement",
    section: "Confidentiality and vendor",
    prompt: "Does the firm have a vendor agreement that addresses confidentiality and data handling?",
    helper: "Look for no training on inputs, retention limits, encryption, access controls, and third-party sharing. Small firms and solos should not assume a consumer tool provides these protections.",
    options: [
      { value: "yes", label: "Yes — the terms are reviewed and appropriate" },
      { value: "no", label: "No or not sure" },
    ],
  },
  {
    id: "toolGrounding",
    section: "Accuracy and reliability",
    prompt: "Is the tool grounded in a verified legal database with citation checking?",
    helper: "Compare a legal-specific tool such as Westlaw CoCounsel or Lexis+ AI with a general-purpose LLM that has no legal verification layer.",
    options: [
      { value: "yes", label: "Yes — legal-specific and citation-grounded" },
      { value: "no", label: "No — general-purpose or unverified tool" },
    ],
  },
  {
    id: "stakes",
    section: "Accuracy and reliability",
    prompt: "What are the stakes if the motion is wrong?",
    helper: "High stakes include dispositive motions, injunctions, appeals, or anything likely to end or substantially reshape the case.",
    options: [
      { value: "low", label: "Lower stakes or routine substantive motion" },
      { value: "high", label: "High stakes, dispositive, emergency, or case-changing" },
    ],
  },
  {
    id: "jurisdictionSpecificity",
    section: "Accuracy and reliability",
    prompt: "Can the tool account for the relevant jurisdiction, practice area, recent authority, and judge-specific preferences?",
    options: [
      { value: "yes", label: "Yes — the scope is current and appropriately specific" },
      { value: "no", label: "No or not sure" },
    ],
  },
  {
    id: "verificationCapacity",
    section: "Professional responsibility",
    prompt: "Can an attorney independently verify every citation, quotation, factual claim, and legal proposition before filing?",
    helper: "The duty to verify does not move to the tool. A solo practitioner must plan for this review personally if there is no second reviewer.",
    options: [
      { value: "yes", label: "Yes — sufficient time and expertise are available" },
      { value: "no", label: "No — the deadline or staffing makes that unrealistic" },
    ],
  },
  {
    id: "disclosure",
    section: "Court and ethics rules",
    prompt: "Have you checked the current judge and jurisdiction rules for AI disclosure or certification?",
    helper: "Standing orders change often. Some courts require disclosure of AI use or certification that citations were human-verified.",
    options: [
      { value: "yes", label: "Yes — no additional requirement, or the requirement is understood" },
      { value: "no", label: "No or unclear — I need to check the current rules" },
    ],
  },
  {
    id: "competence",
    section: "Court and ethics rules",
    prompt: "Can the responsible attorney competently supervise this technology and its output?",
    helper: "Consider Model Rule 1.1, ABA Formal Opinion 512, confidentiality under Model Rule 1.6, and candor to the tribunal under Model Rule 3.3.",
    options: [
      { value: "yes", label: "Yes — the attorney understands the tool's limits and can supervise it" },
      { value: "no", label: "No or not sure" },
    ],
  },
  {
    id: "operations",
    section: "Firm operations and exposure",
    prompt: "Do the time, cost, workflow, and learning investment make sense for this firm?",
    helper: "Weigh subscription cost against time saved, integration with practice-management/document/e-filing systems, and the learning curve.",
    options: [
      { value: "yes", label: "Yes — the workflow has a clear, manageable benefit" },
      { value: "no", label: "No or not yet" },
    ],
  },
  {
    id: "liability",
    section: "Firm operations and exposure",
    prompt: "Has the firm considered malpractice and client-fee implications of AI use?",
    helper: "Check whether malpractice coverage addresses AI-related errors and whether client agreements or billing practices require disclosure when AI materially reduces drafting time.",
    options: [
      { value: "yes", label: "Yes — insurance, client communication, and billing are addressed" },
      { value: "no", label: "No or not sure" },
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
  const [calculationError, setCalculationError] = useState("");

  const groupedQuestions = useMemo(
    () => questions.reduce<Record<string, Question[]>>((groups, question) => {
      (groups[question.section] ??= []).push(question);
      return groups;
    }, {}),
    [],
  );

  function updateAnswer(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setResult(null);
    setCalculationError("");
  }

  function calculateRecommendation() {
    if (missingAnswers.length > 0) {
      document.getElementById(`question-${missingAnswers[0].id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setCalculationError("Answer the highlighted question before viewing your recommendation.");
      return;
    }

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

    try {
      for (const label of treeLabels) {
        nodeId = nextStep(nodeId, label).id;
      }

      const current = decisionTree[nodeId];
      if (current.type === "leaf") {
        setResult(current);
        setCalculationError("");
        document.getElementById("readout")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        setCalculationError("The decision tree did not reach a recommendation. Review your answers and try again.");
      }
    } catch {
      setCalculationError("We could not match those answers to a recommendation. Please review the motion and tool answers and try again.");
    }
  }

  function restart() {
    setAnswers({});
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const missingAnswers = questions.filter((question) => !answers[question.id]);

  return (
    <main className="shell">
      <header>
        <div className="brand"><span className="mark">✦</span> Motion / AI advisor</div>
        <div className="utility">A practical decision tool for legal teams</div>
      </header>

      <section className="hero">
        <h1>Should AI help write your <em>motion?</em></h1>
        <p className="intro">
          Work through the factors that matter for a small firm or solo practice.
          The result is a risk-triage framework, not legal advice.
        </p>
      </section>

      <div className="workspace">
        <section className="form-panel">
          <div className="eyebrow">Step 01 / Make the choice</div>
          <h2>Tell us what you&apos;re working with.</h2>
          <p className="sub">Choose one answer in each section. You can scroll back and change any response before viewing the recommendation.</p>

          {Object.entries(groupedQuestions).map(([section, sectionQuestions], sectionIndex) => (
            <section className="question-section" key={section}>
              <div className="section-heading">
                <span className="section-number">0{sectionIndex + 1}</span>
                <div>
                  <div className="section-label">{section}</div>
                  <p>{sectionQuestions.length} questions</p>
                </div>
              </div>
              {sectionQuestions.map((question, questionIndex) => (
                <fieldset className="field" id={`question-${question.id}`} key={question.id}>
                  <div className="question-meta">Question {String(questionIndex + 1).padStart(2, "0")}</div>
                  <legend>{question.prompt}</legend>
                  {question.helper && <p className="hint">{question.helper}</p>}
                  <div className="options">
                    {question.options.map((option) => (
                      <label className={`option ${answers[question.id] === option.value ? "selected" : ""}`} key={option.value}>
                        <input
                          checked={answers[question.id] === option.value}
                          name={question.id}
                          onChange={() => updateAnswer(question.id, option.value)}
                          type="radio"
                          value={option.value}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </section>
          ))}

          <div className="submit-row">
            <button className="primary-button" disabled={missingAnswers.length > 0} onClick={calculateRecommendation} type="button">
              See my recommendation <span aria-hidden="true">→</span>
            </button>
            {missingAnswers.length > 0 && <span className="missing-note">{missingAnswers.length} question{missingAnswers.length === 1 ? "" : "s"} left</span>}
          </div>
          {calculationError && <p className="calculation-error" role="alert">{calculationError}</p>}

          {result && <Result result={result} answers={answers} onRestart={restart} />}
        </section>

        <aside className="aside">
          <h3>What we&apos;re weighing</h3>
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
  const extraActions = [
    answers.jurisdictionSpecificity !== "yes" && "Confirm the tool reflects current local rules, practice-area authority, and judge-specific preferences.",
    answers.disclosure !== "yes" && "Check the current judge and jurisdiction rules for AI disclosure or certification before filing.",
    answers.competence !== "yes" && "Do not proceed until the responsible attorney can competently supervise the tool and its limitations.",
    answers.taskScope === "substantive" && "Treat generated legal argument as untrusted draft text and independently verify every claim.",
    answers.operations !== "yes" && "Confirm the expected time savings and workflow integration justify the firm's cost and learning investment.",
    answers.liability !== "yes" && "Ask the malpractice carrier and review client/billing agreements for AI-related requirements.",
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
