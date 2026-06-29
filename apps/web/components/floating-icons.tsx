import { Bot, CircleDollarSign, Gauge, LockKeyhole, RadioTower } from "lucide-react";

const icons = [
  { Icon: LockKeyhole, className: "float-icon one" },
  { Icon: CircleDollarSign, className: "float-icon two" },
  { Icon: Bot, className: "float-icon three" },
  { Icon: Gauge, className: "float-icon four" },
  { Icon: RadioTower, className: "float-icon five" },
];

export function FloatingIcons() {
  return (
    <div className="floating-icons" aria-hidden="true">
      {icons.map(({ Icon, className }) => (
        <span className={className} key={className}>
          <Icon size={22} strokeWidth={1.4} />
        </span>
      ))}
    </div>
  );
}
