import { RewardToast } from "../gamification/RewardToast";
import type { RewardPreview } from "../../types/gamification";

export function SuccessState({
  message,
  detail,
  reward
}: {
  message: string;
  detail?: string;
  reward?: RewardPreview;
}) {
  return <RewardToast message={message} detail={detail} reward={reward} />;
}
