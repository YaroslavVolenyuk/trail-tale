import { useState } from "react";

// Lucide-style inline SVGs matching the design exactly
const IconLightbulb = ({ color = "#8E8E93", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5A6 6 0 1 0 6 8c0 1.4.6 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/>
    <path d="M9 18h6"/>
    <path d="M10 22h4"/>
  </svg>
);

const IconChevronDown = ({ color = "#8E8E93" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const IconChevronUp = ({ color = "#8E8E93" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────
// ActiveClueScreen
//
// Props:
//   questTitle     string   — e.g. "Faust Quest"
//   currentClue    number   — e.g. 3
//   totalClues     number   — e.g. 6
//   clueLabel      string   — e.g. "Clue 3"
//   clueHeading    string   — displayed as the riddle title
//   clueBody       string[] — array of paragraphs
//   hint           string   — hint text (shown after toggle)
//   attemptsLeft   number   — e.g. 5
//   onSubmit       fn(code) — called when Submit is tapped
// ─────────────────────────────────────────────────────────────
export default function ActiveClueScreen({
  questTitle = "Faust Quest",
  currentClue = 3,
  totalClues = 6,
  clueLabel = "CLUE 3",
  clueHeading = "The Philosopher's\nForgotten Den",
  clueBody = [
    "Where scholars once gathered to debate the nature of truth and alchemy, a great thinker left behind more than words. Beneath the sign of the golden serpent, where the river bends and lanterns glow amber at dusk, his spirit lingers still.",
    "Seek the place where ink met stone, where the city's memory is carved into cobblestones. Stand before his monument and look east — the next answer is written in plain sight, hidden only by the weight of centuries.",
  ],
  hint = "Look for the bronze plaque on the northern wall of the courtyard — the initials carved there are the key.",
  attemptsLeft = 5,
  onSubmit,
}) {
  const [hintOpen, setHintOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [focused, setFocused] = useState(false);

  const progress = (currentClue / totalClues) * 100;
  const canSubmit = inputVal.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit?.(inputVal.trim());
  };

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: "#0A0A0A",
      fontFamily: "'Inter', system-ui, sans-serif",
      WebkitFontSmoothing: "antialiased",
      color: "#fff",
      maxWidth: 430,
      margin: "0 auto",
    }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px 10px",
        // Respect iOS safe area when running as PWA
        paddingTop: "max(12px, env(safe-area-inset-top, 12px))",
      }}>
        <span style={{
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "-0.2px",
        }}>
          {questTitle}
        </span>
        <span style={{
          color: "#F5A623",
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "-0.2px",
        }}>
          {currentClue} / {totalClues}
        </span>
      </div>

      {/* ── Progress bar ─────────────────────────────────────── */}
      <div style={{ flexShrink: 0, height: 3, background: "#2C2C2E" }}>
        <div style={{
          width: `${progress}%`,
          height: 3,
          background: "#F5A623",
          transition: "width 0.4s ease",
        }} />
      </div>

      {/* ── Scrollable content ───────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: 16,
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}>

        {/* Clue card */}
        <div style={{
          background: "#1C1C1E",
          borderRadius: 16,
          padding: 20,
        }}>

          {/* Label */}
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#F5A623",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}>
            {clueLabel}
          </div>

          {/* Heading */}
          <h2 style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            margin: "0 0 14px",
            lineHeight: 1.3,
            letterSpacing: "-0.3px",
            whiteSpace: "pre-line",
          }}>
            {clueHeading}
          </h2>

          {/* Body paragraphs */}
          {clueBody.map((para, i) => (
            <p key={i} style={{
              fontSize: 15,
              color: "#C7C7CC",
              lineHeight: 1.6,
              margin: i === 0 ? 0 : "12px 0 0",
              letterSpacing: "-0.1px",
            }}>
              {para}
            </p>
          ))}

          {/* Divider */}
          <div style={{ height: 1, background: "#2C2C2E", margin: "16px 0" }} />

          {/* Hint toggle row */}
          <div
            onClick={() => setHintOpen(v => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              userSelect: "none",
            }}
          >
            <IconLightbulb color="#8E8E93" size={18} />
            <span style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#8E8E93",
              flex: 1,
            }}>
              Need a hint?
            </span>
            {hintOpen ? <IconChevronUp /> : <IconChevronDown />}
          </div>

          {/* Hint expanded */}
          {hintOpen && (
            <div style={{
              marginTop: 12,
              background: "#2A2200",
              borderRadius: 12,
              padding: 16,
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 8,
              }}>
                <IconLightbulb color="#F5A623" size={16} />
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#F5A623",
                  letterSpacing: "0.02em",
                }}>
                  Hint
                </span>
              </div>
              <p style={{
                fontSize: 14,
                color: "#E8D5A3",
                fontStyle: "italic",
                margin: 0,
                lineHeight: 1.6,
              }}>
                {hint}
              </p>
            </div>
          )}

        </div>
        {/* / clue card */}

      </div>
      {/* / scrollable */}

      {/* ── Bottom fixed input ───────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        background: "#0A0A0A",
        borderTop: "1px solid #2C2C2E",
        padding: "12px 16px",
        paddingBottom: "max(28px, calc(12px + env(safe-area-inset-bottom, 16px)))",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            placeholder="Enter code"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              height: 48,
              background: "#1C1C1E",
              border: focused ? "1.5px solid #F5A623" : "1.5px solid #3A3A3C",
              borderRadius: 12,
              color: "#fff",
              fontSize: 16,
              fontWeight: 500,
              padding: "0 16px",
              fontFamily: "'Inter', system-ui, sans-serif",
              letterSpacing: "0.05em",
              transition: "border-color 0.15s",
              outline: "none",
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              height: 48,
              padding: "0 20px",
              background: "#F5A623",
              border: "none",
              borderRadius: 999,
              color: "#0A0A0A",
              fontSize: 15,
              fontWeight: 600,
              cursor: canSubmit ? "pointer" : "default",
              fontFamily: "'Inter', system-ui, sans-serif",
              opacity: canSubmit ? 1 : 0.4,
              transition: "opacity 0.15s",
              flexShrink: 0,
              letterSpacing: "-0.1px",
            }}
          >
            Submit
          </button>
        </div>
        <div style={{
          textAlign: "center",
          fontSize: 12,
          color: "#8E8E93",
          marginTop: 8,
          letterSpacing: "-0.1px",
        }}>
          {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
        </div>
      </div>

    </div>
  );
}
