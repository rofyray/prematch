/** A single continuous pole, shared by the introduction and dated runway. */
export default function RunwayFlag() {
  return (
    <svg
      viewBox="0 0 30 100"
      width="30"
      height="100"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 99V4C10 -2 18 10 27 4V24C18 30 10 18 2 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M3 5C10 0 18 11 26 5V23C18 28 10 17 3 23Z"
        fill="currentColor"
        opacity=".16"
      />
    </svg>
  );
}
