import { useMemo, useState } from "react";
import {
  decisionTree,
  nextStep,
  riskLevelColor,
  START_NODE_ID,
  type LeafNode,
  type QuestionNode,
} from "../../lib/motionAiDecisionTree";

type Answer = { nodeId: string; label: string };

const riskLabels = {
  GREEN: "Lower risk",
  YELLOW: "Caution",
  YELLOW_PLUS: "Elevated caution",
  RED: "High risk",
} as const;

export function MotionDecisionWizard() {
  const [currentNodeId, setCurrentNodeId] = useState(START_NODE_ID);
  const [answerHistory, setAnswerHistory] = useState<Answer[]>([]);

  const currentNode = decisionTree[currentNodeId];
  const isQuestion = currentNode.type === "question";
  const question = isQuestion ? (currentNode as QuestionNode) : null;
  const result = !isQuestion ? (currentNode as LeafNode) : null;
  const progress = Math.min(answerHistory.length + 1, 5);

  const historyLabels = useMemo(
    () => answerHistory.map((answer) => answer.label),
    [answerHistory],
  );

  function chooseAnswer(label: string) {
    const nextNode = nextStep(currentNodeId, label);
    setAnswerHistory((history) => [...history, { nodeId: currentNodeId, label }]);
    setCurrentNodeId(nextNode.id);
  }

  function goBack() {
    const previous = answerHistory.at(-1);
    if (!previous) return;
    setAnswerHistory((history) => history.slice(0, -1));
    setCurrentNodeId(previous.nodeId);
  }

  function restart() {
    setAnswerHistory([]);
    setCurrentNodeId(START_NODE_ID);
  }

  return (
    <main className="shell">
      <header>
        <div className="brand">
          <span className="mark">✦</span> Motion / AI advisor
        </div>
        <div className="utility">A practical decision tool for legal teams</div>
      </header>

      <section className="hero">
        <h1>
          Should AI help write your <em>motion?</em>
        </h1>
        <p className="intro">
          Answer one question at a time. Weigh the motion&apos;s stakes,
          confidentiality, tool, and review capacity before choosing a
          workflow.
        </p>
      </section>

      <div className="workspace">
        <section className="form-panel" aria-live="polite">
          <div className="eyebrow">
            {result ? "Your readout" : `Step ${String(progress).padStart(2, "0")}`}
          </div>

          {question ? (
            <>
              <div className="progress" aria-label={`Question ${progress}`}>
                {Array.from({ length: 5 }, (_, index) => (
                  <i
                    className={index < progress ? "active" : ""}
                    key={index}
                  />
                ))}
                <span>One decision at a time</span>
              </div>
              <h2>{question.question}</h2>
              {question.helperText && <p className="sub">{question.helperText}</p>}
              <div className="options">
                {question.options.map((option) => (
                  <button
                    className="option"
                    key={option.label}
                    onClick={() => chooseAnswer(option.label)}
                    type="button"
                  >
                    <span className="option-arrow" aria-hidden="true">
                      →
                    </span>
                    {option.label}
                  </button>
                ))}
              </div>
              {answerHistory.length > 0 && (
                <button className="back-button" onClick={goBack} type="button">
                  ← Back
                </button>
              )}
            </>
          ) : result ? (
            <Result result={result} answers={historyLabels} onRestart={restart} />
          ) : null}
        </section>

        <aside className="aside">
          <h3>What we&apos;re weighing</h3>
          <p>
            This is a risk-triage framework, not legal advice. It helps keep
            legal judgment and verification with the firm.
          </p>
          <div className="signal">
            <span className="dot" />
            <span><b>Motion stakes</b><br />Routine, substantive, or dispositive.</span>
          </div>
          <div className="signal">
            <span className="dot" />
            <span><b>Confidentiality</b><br />What information can enter the tool?</span>
          </div>
          <div className="signal">
            <span className="dot" />
            <span><b>Tool quality</b><br />Is the output grounded and citation-checked?</span>
          </div>
          <div className="signal">
            <span className="dot green" />
            <span><b>Verification</b><br />Who checks every claim before filing?</span>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Result({
  result,
  answers,
  onRestart,
}: {
  result: LeafNode;
  answers: string[];
  onRestart: () => void;
}) {
  const color = riskLevelColor(result.riskLevel);

  return (
    <div className="result">
      <div className="risk-badge" style={{ color, borderColor: color }}>
        <span className="risk-dot" style={{ backgroundColor: color }} />
        {riskLabels[result.riskLevel]}
      </div>
      <h2>Here&apos;s the safest way to use AI.</h2>
      <p className="recommendation-copy">{result.recommendation}</p>
      <div className="result-box">
        <h3>Before you rely on the output</h3>
        <ul>
          {result.requiredActions.map((action) => <li key={action}>{action}</li>)}
        </ul>
      </div>
      <details className="answers">
        <summary>Review your answers</summary>
        <ol>
          {answers.map((answer, index) => <li key={`${index}-${answer}`}>{answer}</li>)}
        </ol>
      </details>
      <button className="primary-button" onClick={onRestart} type="button">
        Start over
      </button>
    </div>
  );
}
