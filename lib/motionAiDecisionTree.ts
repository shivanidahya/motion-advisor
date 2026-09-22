/**
 * motionAiDecisionTree.ts
 *
 * Decision-tree engine for helping small firms / solo practitioners decide
 * whether (and how) to use AI to help draft a motion.
 *
 * DISCLAIMER: This tool provides a structured framework for internal risk
 * triage. It is not legal advice, does not replace independent judgment,
 * and does not guarantee compliance with any jurisdiction's ethics rules
 * or standing orders. Users remain responsible for verifying all AI output
 * and complying with applicable rules of professional conduct.
 *
 * ---------------------------------------------------------------------
 * TREE OVERVIEW (see README section at bottom for prose walkthrough)
 * ---------------------------------------------------------------------
 * Q1_REQUIRES_LEGAL_ANALYSIS
 *  ├─ no  -> Q2A_CONFIDENTIAL_INFO
 *  │         ├─ no  -> LEAF_GREEN_ROUTINE
 *  │         └─ yes -> Q3A_DATA_AGREEMENT
 *  │                   ├─ yes -> LEAF_GREEN_ROUTINE_CONFIDENTIAL
 *  │                   └─ no  -> LEAF_YELLOW_REDACT_FIRST
 *  └─ yes -> Q2B_GROUNDED_TOOL
 *            ├─ no  -> LEAF_RED_UNGROUNDED_TOOL
 *            └─ yes -> Q3B_STAKES
 *                      ├─ high -> Q4B_DISCLOSURE_REQUIRED
 *                      │          ├─ yes -> LEAF_YELLOW_PLUS_HIGH_STAKES
 *                      │          └─ no  -> LEAF_YELLOW_HIGH_STAKES
 *                      └─ low  -> Q4B_VERIFY_CAPACITY
 *                                 ├─ yes -> LEAF_YELLOW_LOW_STAKES
 *                                 └─ no  -> LEAF_RED_NO_VERIFY_CAPACITY
 * ---------------------------------------------------------------------
 */

export type RiskLevel = "GREEN" | "YELLOW" | "YELLOW_PLUS" | "RED";

export interface Option {
  /** Text shown to the user for this choice */
  label: string;
  /** id of the next node (question or leaf) */
  next: string;
}

export interface QuestionNode {
  type: "question";
  id: string;
  question: string;
  /** Optional helper text / examples to display under the question */
  helperText?: string;
  options: Option[];
}

export interface LeafNode {
  type: "leaf";
  id: string;
  riskLevel: RiskLevel;
  recommendation: string;
  requiredActions: string[];
}

export type TreeNode = QuestionNode | LeafNode;

export const START_NODE_ID = "Q1_REQUIRES_LEGAL_ANALYSIS";

export const decisionTree: Record<string, TreeNode> = {
  Q1_REQUIRES_LEGAL_ANALYSIS: {
    type: "question",
    id: "Q1_REQUIRES_LEGAL_ANALYSIS",
    question: "Does this motion require legal analysis or citation of case law/statutes?",
    helperText:
      "Routine/administrative examples: scheduling motions, extension requests, notices of appearance. " +
      "Substantive examples: motions to dismiss, summary judgment, motions in limine, injunctions.",
    options: [
      { label: "No — routine/administrative", next: "Q2A_CONFIDENTIAL_INFO" },
      { label: "Yes — substantive legal argument", next: "Q2B_GROUNDED_TOOL" },
    ],
  },

  // ---------------- Low-complexity branch ----------------
  Q2A_CONFIDENTIAL_INFO: {
    type: "question",
    id: "Q2A_CONFIDENTIAL_INFO",
    question: "Will you need to enter any confidential client information into the AI tool?",
    options: [
      { label: "No", next: "LEAF_GREEN_ROUTINE" },
      { label: "Yes", next: "Q3A_DATA_AGREEMENT" },
    ],
  },

  Q3A_DATA_AGREEMENT: {
    type: "question",
    id: "Q3A_DATA_AGREEMENT",
    question:
      "Does your firm have a data/confidentiality agreement with the AI vendor (e.g., enterprise plan, no training on inputs, encryption at rest)?",
    options: [
      { label: "Yes", next: "LEAF_GREEN_ROUTINE_CONFIDENTIAL" },
      { label: "No / not sure", next: "LEAF_YELLOW_REDACT_FIRST" },
    ],
  },

  // ---------------- Substantive-content branch ----------------
  Q2B_GROUNDED_TOOL: {
    type: "question",
    id: "Q2B_GROUNDED_TOOL",
    question:
      "Is the AI tool grounded in a verified legal database with citation-checking (e.g., Westlaw CoCounsel, Lexis+ AI), rather than a general-purpose LLM?",
    options: [
      { label: "Yes", next: "Q3B_STAKES" },
      { label: "No / general-purpose LLM", next: "LEAF_RED_UNGROUNDED_TOOL" },
    ],
  },

  Q3B_STAKES: {
    type: "question",
    id: "Q3B_STAKES",
    question: "What are the stakes of this motion?",
    helperText:
      "High: dispositive motions, injunctions, appellate briefs, anything likely to end or substantially reshape the case. " +
      "Low: routine substantive motions (e.g., standard discovery disputes, unopposed motions in limine).",
    options: [
      { label: "High stakes / dispositive", next: "Q4B_DISCLOSURE_REQUIRED" },
      { label: "Lower stakes / routine substantive", next: "Q4B_VERIFY_CAPACITY" },
    ],
  },

  Q4B_DISCLOSURE_REQUIRED: {
    type: "question",
    id: "Q4B_DISCLOSURE_REQUIRED",
    question:
      "Does the presiding judge or jurisdiction have a standing order requiring disclosure or certification of AI use?",
    helperText:
      "Check the specific judge's standing orders, not just the district/court generally — these vary widely and change often.",
    options: [
      { label: "Yes", next: "LEAF_YELLOW_PLUS_HIGH_STAKES" },
      { label: "No / unclear", next: "LEAF_YELLOW_HIGH_STAKES" },
    ],
  },

  Q4B_VERIFY_CAPACITY: {
    type: "question",
    id: "Q4B_VERIFY_CAPACITY",
    question:
      "Do you have the time/capacity to independently verify every AI-generated citation and legal claim before filing?",
    options: [
      { label: "Yes", next: "LEAF_YELLOW_LOW_STAKES" },
      { label: "No", next: "LEAF_RED_NO_VERIFY_CAPACITY" },
    ],
  },

  // ---------------- Leaves ----------------
  LEAF_GREEN_ROUTINE: {
    type: "leaf",
    id: "LEAF_GREEN_ROUTINE",
    riskLevel: "GREEN",
    recommendation:
      "Safe to use AI drafting for this task. Low-risk, routine content with no confidentiality concerns.",
    requiredActions: [
      "Light proofreading pass before filing.",
      "Confirm formatting matches local court rules.",
    ],
  },

  LEAF_GREEN_ROUTINE_CONFIDENTIAL: {
    type: "leaf",
    id: "LEAF_GREEN_ROUTINE_CONFIDENTIAL",
    riskLevel: "GREEN",
    recommendation:
      "Safe to proceed. Routine task and your vendor agreement covers confidentiality.",
    requiredActions: [
      "Confirm the specific inputs used still fall within the scope of your data agreement.",
      "Light proofreading pass before filing.",
    ],
  },

  LEAF_YELLOW_REDACT_FIRST: {
    type: "leaf",
    id: "LEAF_YELLOW_REDACT_FIRST",
    riskLevel: "YELLOW",
    recommendation:
      "Proceed with caution. No confirmed data protection agreement is in place with this vendor.",
    requiredActions: [
      "Redact or anonymize client-identifying details before entering into the tool, where possible.",
      "Review the vendor's data retention / training policy before broader use.",
      "Consider negotiating an enterprise or no-training-on-inputs agreement if this will be a recurring need.",
    ],
  },

  LEAF_RED_UNGROUNDED_TOOL: {
    type: "leaf",
    id: "LEAF_RED_UNGROUNDED_TOOL",
    riskLevel: "RED",
    recommendation:
      "High risk. General-purpose LLMs are prone to fabricating case citations and holdings for substantive legal content.",
    requiredActions: [
      "Use the tool only as a brainstorming/outlining aid, not for citations or legal propositions.",
      "Independently verify 100% of any case law, statutes, or quotations against primary sources (e.g., Westlaw, Lexis, PACER) before filing.",
      "Consider switching to a legal-specific, citation-verified tool for this type of task.",
    ],
  },

  LEAF_YELLOW_PLUS_HIGH_STAKES: {
    type: "leaf",
    id: "LEAF_YELLOW_PLUS_HIGH_STAKES",
    riskLevel: "YELLOW_PLUS",
    recommendation:
      "Elevated caution. High-stakes motion, grounded tool, and a mandatory disclosure/certification requirement applies.",
    requiredActions: [
      "Full independent verification of every citation and legal proposition before filing.",
      "Comply with the jurisdiction's/judge's AI disclosure or certification requirement.",
      "Strongly consider a second reviewer (co-counsel, contract attorney, or peer review) given the stakes.",
      "Document your verification process in case it is later questioned.",
    ],
  },

  LEAF_YELLOW_HIGH_STAKES: {
    type: "leaf",
    id: "LEAF_YELLOW_HIGH_STAKES",
    riskLevel: "YELLOW",
    recommendation:
      "Proceed with caution. High-stakes motion using a grounded tool; no confirmed disclosure requirement, but verification is still essential.",
    requiredActions: [
      "Full independent verification of every citation and legal proposition before filing.",
      "Re-check for any judge-specific standing order on AI use — these change frequently.",
      "Strongly recommend a second reviewer given the stakes, even if solo (e.g., a peer-review arrangement with another practitioner).",
    ],
  },

  LEAF_YELLOW_LOW_STAKES: {
    type: "leaf",
    id: "LEAF_YELLOW_LOW_STAKES",
    riskLevel: "YELLOW",
    recommendation:
      "Proceed with caution. Routine substantive motion using a grounded tool, and you have verification capacity.",
    requiredActions: [
      "Verify all citations against primary sources before filing.",
      "Check jurisdiction/judge disclosure requirements.",
    ],
  },

  LEAF_RED_NO_VERIFY_CAPACITY: {
    type: "leaf",
    id: "LEAF_RED_NO_VERIFY_CAPACITY",
    riskLevel: "RED",
    recommendation:
      "Do not file AI-assisted substantive content without full verification — this is true even for a grounded tool.",
    requiredActions: [
      "Do not use AI for this task unless you can allocate time to verify every citation and claim.",
      "Alternative: use AI only for outlining/structure, then draft the substantive analysis yourself.",
      "If time is the constraint, consider whether outside co-counsel review is more efficient than AI here.",
    ],
  },
};

/**
 * Walk the tree given a sequence of option labels chosen (in order).
 * Returns the resulting node after each answer, ending on a LeafNode.
 *
 * Example:
 *   const result = traverse(["Yes — substantive legal argument", "Yes", "Lower stakes / routine substantive", "Yes"]);
 *   // result.type === "leaf", result.riskLevel === "YELLOW"
 */
export function traverse(answerLabels: string[]): TreeNode {
  let current: TreeNode = decisionTree[START_NODE_ID];

  for (const label of answerLabels) {
    if (current.type !== "question") break;
    const chosen = current.options.find((o) => o.label === label);
    if (!chosen) {
      throw new Error(
        `Invalid answer "${label}" for question "${current.id}". Valid options: ${current.options
          .map((o) => o.label)
          .join(", ")}`
      );
    }
    current = decisionTree[chosen.next];
  }

  return current;
}

/**
 * Single-step helper for building an interactive UI:
 * given the current node id and a chosen option label, returns the next node.
 */
export function nextStep(currentNodeId: string, chosenLabel: string): TreeNode {
  const current = decisionTree[currentNodeId];
  if (current.type !== "question") {
    throw new Error(`Node "${currentNodeId}" is a leaf; there is no next step.`);
  }
  const chosen = current.options.find((o) => o.label === chosenLabel);
  if (!chosen) {
    throw new Error(`Invalid answer "${chosenLabel}" for question "${currentNodeId}".`);
  }
  return decisionTree[chosen.next];
}

/**
 * Color/badge helper for UI styling by risk level.
 */
export function riskLevelColor(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "GREEN":
      return "#16a34a"; // green-600
    case "YELLOW":
      return "#ca8a04"; // yellow-600
    case "YELLOW_PLUS":
      return "#d97706"; // amber-600
    case "RED":
      return "#dc2626"; // red-600
  }
}

/**
 * Standalone confidentiality checklist — useful as an overlay reminder
 * regardless of which branch/leaf the user ends up on, since confidentiality
 * concerns can arise even in the "substantive" branch and aren't re-asked there.
 */
export const confidentialityChecklist: string[] = [
  "Have you reviewed the AI vendor's data retention and model-training policy?",
  "Is client-identifying information redacted or anonymized where feasible?",
  "Does your engagement letter or firm policy address AI use and client disclosure?",
  "If using a browser-based/consumer AI tool, confirm it is not a public/free tier that trains on inputs.",
];
