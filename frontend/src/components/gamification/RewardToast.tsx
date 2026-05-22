import type { RewardPreview } from "../../types/gamification";

export function RewardToast({
  message,
  detail,
  reward
}: {
  message: string;
  detail?: string;
  reward?: RewardPreview;
}) {
  const hasXp = Boolean(reward?.xp && reward.xp > 0);

  return (
    <div className="reward-toast" role="status">
      {hasXp && <span className="reward-mark">+{reward?.xp} XP</span>}
      <div>
        <strong>{message}</strong>
        {reward ? <p>{reward.title} · {reward.detail}</p> : detail && <p>{detail}</p>}
      </div>
    </div>
  );
}
