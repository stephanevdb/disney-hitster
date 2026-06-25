import { NeonRings } from "./NeonRings";

interface NeonStageProps {
  active?: boolean;
  /** When false, only the gradient background is shown (rings placed elsewhere). */
  showRings?: boolean;
}

export function NeonStage({ active = false, showRings = true }: NeonStageProps) {
  return (
    <div className={`neon-stage${active ? " neon-stage--active" : ""}`} aria-hidden="true">
      <div className="neon-stage__glow" />
      {showRings ? <NeonRings active={active} className="neon-stage__rings" /> : null}
    </div>
  );
}
