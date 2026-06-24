interface HitsterLogoProps {
  size?: "sm" | "lg";
  subtitle?: string;
}

export function HitsterLogo({ size = "lg", subtitle }: HitsterLogoProps) {
  return (
    <div className={`hitster-logo hitster-logo--${size}`}>
      <p className="hitster-logo__brand">
        <span className="hitster-logo__disney">Disney</span>
        <span className="hitster-logo__hitster">Hitster</span>
      </p>
      {subtitle ? <p className="hitster-logo__subtitle">{subtitle}</p> : null}
    </div>
  );
}
