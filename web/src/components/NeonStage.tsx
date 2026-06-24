interface NeonStageProps {
  active?: boolean;
}

export function NeonStage({ active = false }: NeonStageProps) {
  return (
    <div className={`neon-stage${active ? " neon-stage--active" : ""}`} aria-hidden="true">
      <div className="neon-stage__glow" />
      <svg className="neon-stage__rings" viewBox="0 0 400 400">
        <g className="neon-stage__spin neon-stage__spin--slow">
          <circle cx="200" cy="200" r="168" className="neon-ring neon-ring--yellow" />
          <circle cx="200" cy="200" r="138" className="neon-ring neon-ring--magenta" />
        </g>
        <g className="neon-stage__spin neon-stage__spin--mid">
          <circle cx="200" cy="200" r="108" className="neon-ring neon-ring--cyan" />
          <circle cx="200" cy="200" r="78" className="neon-ring neon-ring--yellow" />
        </g>
        <g className="neon-stage__spin neon-stage__spin--fast">
          <circle cx="200" cy="200" r="48" className="neon-ring neon-ring--magenta" />
        </g>
      </svg>
    </div>
  );
}
