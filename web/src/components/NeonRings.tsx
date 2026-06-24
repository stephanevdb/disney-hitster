interface NeonRingsProps {
  active?: boolean;
  className?: string;
}

function RingLayer({
  className,
  circles,
}: {
  className: string;
  circles: Array<{ r: number; color: "yellow" | "magenta" | "cyan" }>;
}) {
  return (
    <g className={className}>
      {circles.map((circle) => (
        <circle
          key={`${circle.r}-${circle.color}`}
          cx="0"
          cy="0"
          r={circle.r}
          className={`neon-ring neon-ring--${circle.color}`}
        />
      ))}
    </g>
  );
}

export function NeonRings({ active = false, className = "" }: NeonRingsProps) {
  return (
    <svg
      className={`neon-rings${active ? " neon-rings--active" : ""}${className ? ` ${className}` : ""}`}
      viewBox="0 0 400 400"
      aria-hidden="true"
    >
      <g transform="translate(200 200)">
        <RingLayer
          className="neon-rings__spin neon-rings__spin--slow"
          circles={[
            { r: 168, color: "yellow" },
            { r: 138, color: "magenta" },
          ]}
        />
        <RingLayer
          className="neon-rings__spin neon-rings__spin--mid"
          circles={[
            { r: 108, color: "cyan" },
            { r: 78, color: "yellow" },
          ]}
        />
        <RingLayer
          className="neon-rings__spin neon-rings__spin--fast"
          circles={[{ r: 48, color: "magenta" }]}
        />
      </g>
    </svg>
  );
}
