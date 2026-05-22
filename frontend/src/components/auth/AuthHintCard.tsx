export function AuthHintCard() {
  return (
    <aside className="auth-hint-card" aria-label="Подсказка о возможностях Steply">
      <div>
        <span>Что нового?</span>
        <p>Следите за привычками, получайте советы и развивайте питомца</p>
      </div>
      <svg
        className="auth-hint-arrow"
        viewBox="0 0 148 74"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 16C43 3 88 11 113 43"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M111 24L119 50L93 45"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </aside>
  );
}
