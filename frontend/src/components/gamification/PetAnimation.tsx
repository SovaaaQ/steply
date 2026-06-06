import type { PetState, PetType } from "../../types/auth";
import { petStateShortLabels, petTypeLabels } from "../../utils/gamification";

interface PetAnimationProps {
  petType?: PetType | null;
  state: PetState;
  isConfigured?: boolean;
  level?: number;
  size?: "mini" | "large";
}

export function PetAnimation({
  petType,
  state,
  isConfigured = true,
  level,
  size = "large"
}: PetAnimationProps) {
  const typeLabel = isConfigured && petType ? petTypeLabels[petType] : "Питомец";
  const stateLabel = isConfigured ? petStateShortLabels[state] : "выбор";
  const mascotType = isConfigured && petType ? petType : "unconfigured";

  return (
    <div
      className={`pet-animation pet-animation-${state} pet-animation-${size} ${
        isConfigured ? "" : "pet-animation-unconfigured"
      }`}
      aria-label={`${typeLabel}: ${stateLabel}`}
    >
      <PetMascot petType={mascotType} state={state} />
      {level && isConfigured && <span className="pet-animation-level">ур {level}</span>}
      <span className="pet-animation-caption">{stateLabel}</span>
    </div>
  );
}

function PetMascot({
  petType,
  state
}: {
  petType: PetType | "unconfigured";
  state: PetState;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`pet-mascot pet-mascot-${petType} pet-mascot-${state}`}
      focusable="false"
      viewBox="0 0 160 160"
    >
      {petType === "dog" && <DogMascot />}
      {petType === "cat" && <CatMascot />}
      {petType === "parrot" && <ParrotMascot />}
      {petType === "hamster" && <HamsterMascot />}
      {petType === "unconfigured" && <UnconfiguredMascot />}
    </svg>
  );
}

function DogMascot() {
  return (
    <g className="pet-mascot-character">
      <path className="pet-mascot-tail" d="M113 104c20-8 24-27 10-30-9-2-13 8-8 15" />
      <ellipse className="pet-mascot-body" cx="80" cy="98" rx="42" ry="39" />
      <ellipse className="pet-mascot-ear pet-mascot-ear-left" cx="48" cy="70" rx="15" ry="29" />
      <ellipse className="pet-mascot-ear pet-mascot-ear-right" cx="112" cy="70" rx="15" ry="29" />
      <circle className="pet-mascot-head" cx="80" cy="67" r="37" />
      <ellipse className="pet-mascot-muzzle" cx="80" cy="80" rx="22" ry="16" />
      <circle className="pet-mascot-eye pet-mascot-eye-left" cx="67" cy="62" r="4.5" />
      <circle className="pet-mascot-eye pet-mascot-eye-right" cx="93" cy="62" r="4.5" />
      <path className="pet-mascot-nose" d="M74 75c3-4 9-4 12 0-1 6-11 6-12 0Z" />
      <path className="pet-mascot-mouth" d="M80 82c-2 6-7 7-11 4M80 82c2 6 7 7 11 4" />
      <path className="pet-mascot-highlight" d="M58 46c8-9 22-14 35-10" />
    </g>
  );
}

function CatMascot() {
  return (
    <g className="pet-mascot-character">
      <path className="pet-mascot-tail" d="M109 105c28-6 29-43 5-40-11 2-11 18 1 18" />
      <ellipse className="pet-mascot-body" cx="80" cy="103" rx="34" ry="31" />
      <path className="pet-mascot-ear pet-mascot-ear-left" d="M45 51 59 17l23 32Z" />
      <path className="pet-mascot-ear pet-mascot-ear-right" d="M115 51 101 17 78 49Z" />
      <ellipse className="pet-mascot-head" cx="80" cy="68" rx="43" ry="40" />
      <path className="pet-mascot-ear-inner pet-mascot-ear-left" d="M56 48 62 34l10 14Z" />
      <path className="pet-mascot-ear-inner pet-mascot-ear-right" d="M104 48 98 34 88 48Z" />
      <circle className="pet-mascot-eye pet-mascot-eye-left" cx="66" cy="64" r="4.8" />
      <circle className="pet-mascot-eye pet-mascot-eye-right" cx="94" cy="64" r="4.8" />
      <path className="pet-mascot-nose" d="M75 77h10l-5 6Z" />
      <path className="pet-mascot-mouth" d="M80 84c-2 4-5 5-8 4M80 84c2 4 5 5 8 4" />
      <path className="pet-mascot-whisker" d="M62 77H42M63 84 45 89M98 77h20M97 84l18 5" />
      <path className="pet-mascot-paw pet-mascot-paw-left" d="M67 125c3 4 9 4 12 0" />
      <path className="pet-mascot-paw pet-mascot-paw-right" d="M84 125c3 4 9 4 12 0" />
      <path className="pet-mascot-highlight" d="M57 45c10-8 23-11 37-7" />
    </g>
  );
}

function ParrotMascot() {
  return (
    <g className="pet-mascot-character">
      <path className="pet-mascot-tail" d="M87 118 109 145 101 115Z" />
      <ellipse className="pet-mascot-body" cx="80" cy="92" rx="35" ry="44" />
      <path className="pet-mascot-wing" d="M54 86c-17 9-19 34-6 46 13-6 24-21 28-42Z" />
      <circle className="pet-mascot-head" cx="80" cy="53" r="33" />
      <path className="pet-mascot-crest" d="M69 26c-3-13 10-16 13-4 4-12 18-7 10 5" />
      <path className="pet-mascot-beak" d="M102 57c21 2 23 16 1 19-4-8-4-12-1-19Z" />
      <circle className="pet-mascot-face-patch" cx="75" cy="55" r="17" />
      <circle className="pet-mascot-eye pet-mascot-eye-left" cx="78" cy="51" r="4.5" />
      <path className="pet-mascot-eye pet-mascot-eye-right" d="M96 52c3 1 5 3 6 6" />
      <path className="pet-mascot-highlight" d="M58 75c6-11 15-17 28-17" />
    </g>
  );
}

function HamsterMascot() {
  return (
    <g className="pet-mascot-character">
      <ellipse className="pet-mascot-body" cx="80" cy="101" rx="35" ry="34" />
      <ellipse className="pet-mascot-ear pet-mascot-ear-left" cx="52" cy="57" rx="11" ry="13" />
      <ellipse className="pet-mascot-ear pet-mascot-ear-right" cx="108" cy="57" rx="11" ry="13" />
      <ellipse className="pet-mascot-head" cx="80" cy="69" rx="38" ry="34" />
      <ellipse className="pet-mascot-ear-inner pet-mascot-ear-left" cx="53" cy="59" rx="5.5" ry="7" />
      <ellipse className="pet-mascot-ear-inner pet-mascot-ear-right" cx="107" cy="59" rx="5.5" ry="7" />
      <ellipse className="pet-mascot-cheek pet-mascot-cheek-left" cx="63" cy="82" rx="16" ry="14" />
      <ellipse className="pet-mascot-cheek pet-mascot-cheek-right" cx="97" cy="82" rx="16" ry="14" />
      <ellipse className="pet-mascot-muzzle" cx="80" cy="79" rx="10" ry="8" />
      <circle className="pet-mascot-eye pet-mascot-eye-left" cx="68" cy="65" r="4.2" />
      <circle className="pet-mascot-eye pet-mascot-eye-right" cx="92" cy="65" r="4.2" />
      <path className="pet-mascot-nose" d="M75 75c3-4 7-4 10 0-1 5-9 5-10 0Z" />
      <path className="pet-mascot-mouth" d="M80 80v5M80 85c-3 5-9 7-14 3M80 85c3 5 9 7 14 3" />
      <path className="pet-mascot-whisker" d="M63 80H47M64 87l-15 6M97 80h16M96 87l15 6" />
      <path className="pet-mascot-paw pet-mascot-paw-left" d="M61 106c4 5 11 5 15 0" />
      <path className="pet-mascot-paw pet-mascot-paw-right" d="M84 106c4 5 11 5 15 0" />
      <path className="pet-mascot-paw pet-mascot-foot-left" d="M62 130c4 4 12 4 16 0" />
      <path className="pet-mascot-paw pet-mascot-foot-right" d="M82 130c4 4 12 4 16 0" />
      <path className="pet-mascot-highlight" d="M62 49c8-7 21-10 33-6" />
    </g>
  );
}

function UnconfiguredMascot() {
  return (
    <g className="pet-mascot-character pet-mascot-unconfigured-mark">
      <path className="pet-mascot-body" d="M80 31c27 0 48 24 48 54 0 31-20 52-48 52s-48-21-48-52c0-30 21-54 48-54Z" />
      <path className="pet-mascot-highlight" d="M58 51c10-10 26-15 43-9" />
      <path className="pet-mascot-question" d="M67 68c2-12 23-17 30-4 8 15-15 19-15 31" />
      <circle className="pet-mascot-question-dot" cx="82" cy="108" r="5" />
    </g>
  );
}
