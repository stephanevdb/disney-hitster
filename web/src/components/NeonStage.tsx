import { NeonRings } from "./NeonRings";

interface NeonStageProps {
  active?: boolean;
}

export function NeonStage({ active = false }: NeonStageProps) {
  return (
    <div className={`neon-stage${active ? " neon-stage--active" : ""}`} aria-hidden="true">
      <div className="neon-stage__glow" />
      <NeonRings active={active} className="neon-stage__rings" />
    </div>
  );
}
