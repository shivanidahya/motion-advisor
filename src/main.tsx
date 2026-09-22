import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionDecisionWizard } from "./components/MotionDecisionWizard";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionDecisionWizard />
  </StrictMode>,
);
