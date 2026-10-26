import type { Plan } from '../content/schema';

/** "Key position" card: the plans to aim for, each drawn on the board when picked. */
export function KeyPosition({ plans, selected, onSelect }: {
  plans: Plan[];
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="key-position">
      <span className="pill pill-key">Key position</span>
      <p>This is the position to aim for. What's next? Pick a plan:</p>
      <div className="plans">
        {plans.map((plan, i) => (
          <button key={plan.name} className={`chip${selected === i ? ' on' : ''}`} aria-pressed={selected === i} onClick={() => onSelect(i)}>
            {plan.name}
          </button>
        ))}
      </div>
      {selected !== null && <p className="plan-text">{plans[selected].text}</p>}
    </div>
  );
}
