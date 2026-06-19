# Design Prompts — Quest Web App (iOS-inspired, Web-native)

## Style Foundation (вставлять в каждый промпт)

```
Mobile-first PWA, iOS-inspired aesthetic adapted for web.
Font: Inter (Google Fonts) — Display weight for headings, Regular for body.
Color palette:
  Background: #0A0A0A (near black)
  Surface cards: #1C1C1E
  Surface elevated: #2C2C2E
  Accent: #F5A623 (amber)
  Text primary: #FFFFFF
  Text secondary: #8E8E93
  Error: #FF453A
  Success: #32D74B
Border radius: 16px cards, 12px inputs, 999px pills.
Icons: Lucide icon set (outline style).
Components: shadcn/ui adapted with custom dark theme.
No native iOS elements. Web-native interactions only.
Show in iPhone 15 Pro browser frame (390px wide), dark mode.
```

---

## Screen 1 — Welcome / Splash

```
Mobile web splash screen for a city walking quest PWA.
Full viewport height, dark background #0A0A0A.
Center-aligned layout with vertical flex.
Top third: logo mark — minimalist keyhole merged with a map pin, amber #F5A623,
  SVG icon ~72px. App name "TrailTale" below in Inter 700 32px white.
  Tagline "Explore the city. Solve the mystery." Inter 400 16px, #8E8E93.
Middle: empty breathing room.
Bottom third:
  Primary CTA button — full width, amber fill, "Get Started" Inter 600 17px dark label,
  height 52px, border-radius 14px.
  Ghost link below: "Have a team code?" in #8E8E93, 14px, tap target padded.
  Bottom padding respects mobile browser chrome (env safe-area-inset-bottom).
No images, no illustrations. Pure typography + icon. Atmospheric by restraint.
iPhone 15 Pro browser frame, 390px, dark mode.
```

---

## Screen 2 — Language & Mode Selection

```
Mobile web onboarding screen, step 1.
Custom top bar: left chevron icon (Lucide, #8E8E93), center title "New Game" Inter 600 17px white.
Scrollable content below (no native scroll indicators shown).

Section "Choose language" — label Inter 500 13px #8E8E93 uppercase tracked.
Horizontal pill row: 3 buttons "🇺🇦 UA" / "🇬🇧 EN" / "🇦🇹 DE", equal width,
  height 40px, border-radius 999px.
  Selected: amber fill, #0A0A0A label. Unselected: #2C2C2E surface, #8E8E93 label.

Section "How do you play?" — same label style.
Two cards stacked, full width, 12px gap:
  Card surface #1C1C1E, border-radius 16px, padding 20px 16px.
  Card 1: Lucide "user" icon 24px amber left. "Solo" Inter 700 17px white.
    "Play on your own" Inter 400 14px #8E8E93. Lucide "chevron-right" right.
  Card 2: Lucide "users" icon 24px amber left. "Team" Inter 700 17px white.
    "Share a code with friends" Inter 400 14px #8E8E93. Lucide "chevron-right" right.
  Selected card: 2px amber left border + #232323 background shift.

Bottom fixed bar: "Continue" button full width amber 52px, Inter 600 17px, border-radius 14px.
Safe area bottom padding 16px.
iPhone 15 Pro browser frame, dark mode.
```

---

## Screen 3 — Nickname Entry

```
Mobile web form screen.
Custom top bar: chevron back left in #8E8E93. "Your Name" title centered Inter 600 17px white.

Content area, top-padded 32px:
  Heading "What's your name?" Inter 700 28px white, left-aligned.
  Subtext "Shown on the leaderboard" Inter 400 15px #8E8E93, margin-top 6px.

Input field, margin-top 32px:
  Height 52px, background #1C1C1E, border-radius 12px, border 1.5px solid #3A3A3C.
  Focused state: amber border #F5A623, no glow/blur (web-safe style).
  Placeholder "Nickname" in #8E8E93. Typed text white Inter 400 17px.
  Character counter top-right inside field "0 / 20" in #8E8E93 12px.

Mobile keyboard open (generic dark keyboard shown).
Input accessory bar above keyboard: "Continue" full-width amber button 52px,
  dimmed opacity 0.4 when field empty, full opacity when filled.

Nothing else on screen. Spacious, focused.
iPhone 15 Pro browser frame, keyboard open, dark mode.
```

---

## Screen 4 — Team: Create or Join

```
Mobile web screen, two clear paths.
Custom top bar: back chevron, "Team" title centered.

Top half — "Create a Team":
  Section label "CREATE A TEAM" Inter 500 12px #8E8E93 uppercase tracked.
  Input field "Team name" same style as screen 3, not focused.
  Helper text below: "You'll get a 6-character join code to share." #8E8E93 13px.
  "Create Team" button full-width amber 52px.

Divider section: horizontal line #2C2C2E, "or" centered in #8E8E93 13px Inter 400.

Bottom half — "Join a Team":
  Section label "JOIN A TEAM" same style.
  Input field placeholder "Enter code — e.g. WLF-47", monospace Inter Mono 17px for typed value,
  wide letter-spacing on entered text.
  "Join" button full-width, background #2C2C2E, white label, 52px height.

Bottom safe area padding.
iPhone 15 Pro browser frame, dark mode.
```

---

## Screen 5 — Active Clue (Core Game Screen)

```
Mobile web game screen. Most important screen in the app.
Custom top bar: quest title "Faust Quest" Inter 600 15px white left.
  Right: step counter "3 / 6" Inter 600 15px amber.
Progress bar: full width, 3px height, #2C2C2E track, amber fill 50%, no border-radius on bar.

Scrollable content area:

Main clue card — #1C1C1E surface, border-radius 16px, margin 16px, padding 20px:
  Top: "CLUE 3" label Inter 600 11px amber uppercase tracked, margin-bottom 12px.
  Heading: clue title Inter 700 22px white, 2 lines.
  Body text: riddle paragraph Inter 400 15px #C7C7CC line-height 1.6. Approx 6-8 lines.
  Divider #2C2C2E 1px, margin 16px 0.
  Hint row — collapsed: Lucide "lightbulb" icon #8E8E93, "Need a hint?" Inter 500 14px #8E8E93,
  Lucide "chevron-down" right. Tap to expand.

Bottom fixed input section (above mobile browser chrome):
  Background #0A0A0A, top border 1px #2C2C2E.
  Padding 12px 16px + safe area.
  Input field: height 48px, #1C1C1E bg, border-radius 12px, 1.5px border #3A3A3C,
  placeholder "Enter code" #8E8E93, amber border when focused.
  "Submit" button right of field: amber pill 48px padding-x 20px Inter 600 15px, dimmed if empty.
  Below: "5 attempts remaining" #8E8E93 12px centered.

iPhone 15 Pro browser frame, dark mode.
```

---

## Screen 6 — Code Entry (Keyboard Open)

```
Mobile web game screen, keyboard open state.
Same layout as Screen 5 but shifted up — clue card partially visible at top, scrolled.
Only bottom 40% of screen visible: bottom of clue card, then input section.

Input field active state: amber 1.5px border, amber cursor blinking.
Typed text: "VASIL" Inter 500 17px white, letter-spacing 0.1em.
Input field same 48px height, #1C1C1E bg.
"Submit" button right: full amber (text entered), Lucide "arrow-right" icon instead of text.

Mobile dark keyboard visible below, generic web keyboard style.
No accessory bar needed — Submit is inline with input.

Top of screen shows blurred/faded clue title still readable.
iPhone 15 Pro browser frame, dark mode.
```

---

## Screen 7 — Wrong Code / Hint Revealed

```
Mobile web game screen, error + hint state.
Same structure as Screen 5.

Input field: #FF453A border 1.5px (error red), text "WRONG" shown then clearing implied.
Below input: inline error message "Incorrect code. Try again." Lucide "x-circle" icon left,
  #FF453A color, Inter 400 13px. No toast, inline only.
"Attempts remaining: 3" in #FF453A (escalated color when low).

Hint card now expanded inside main card:
  Separate sub-card #2A2200 background (very dark amber tint), border-radius 12px, padding 16px.
  Lucide "lightbulb" icon amber 18px + "Hint" label amber Inter 600 13px, row.
  Hint text below: Inter 400 14px #E8D5A3 (warm off-white), italic style via font-style.
  Small "chevron-up" to collapse, #8E8E93.

"Submit" button: still amber, label "Try Again".
Rest of screen unchanged.
iPhone 15 Pro browser frame, dark mode.
```

---

## Screen 8 — Correct Code / Level Complete

```
Mobile web success transition screen. Full viewport.
Background #0A0A0A with very subtle radial warm glow center: amber at 0% opacity 0.06, transparent at 60%.
Implemented as CSS radial-gradient overlay — no blur, no image.

Center-aligned vertical flex, full height:
  Lucide "check-circle" icon, 80px, amber #F5A623. Filled variant if available.
  "Correct!" Inter 700 34px white, margin-top 20px.
  "You found:" Inter 400 15px #8E8E93, margin-top 8px.
  Component name "Viper's Venom 🐍" Inter 600 17px white.

Progress dots row, margin-top 32px:
  6 circles 10px diameter, 8px gap.
  Completed: amber fill. Current: white fill with amber ring. Future: #3A3A3C.

Team note (if team): Lucide "users" icon 14px + "Team notified" Inter 400 13px #8E8E93, row, margin-top 16px.

Bottom fixed: "Next Clue" button full-width amber 52px, Lucide "arrow-right" inline icon right.
Safe area bottom padding.

No confetti, no animation references. Clean, satisfying, minimal.
iPhone 15 Pro browser frame, dark mode.
```

---

## Screen 9 — Quest Complete / Final Screen

```
Mobile web completion screen.
Top: custom bar with just the app name, no back button.

Content scrollable:
  Top section: Lucide "trophy" icon 64px amber, centered, margin-top 40px.
  "Quest Complete" Inter 700 30px white centered.
  Team/player name "🐺 Вовки" Inter 500 17px #8E8E93 centered, margin-top 6px.

Stats card #1C1C1E, border-radius 16px, margin 24px 16px 0, padding 20px:
  Three equal columns: Time / Clues / Attempts.
  Each column: value Inter 700 24px white, label Inter 400 12px #8E8E93 below.
  Values: "1h 23m" / "6 / 6" / "14".
  Thin vertical dividers #2C2C2E between columns.

Leaderboard section, margin-top 24px:
  Label "LEADERBOARD" uppercase tracked amber 11px Inter 600.
  3 rows: rank number (Inter 700 15px #8E8E93), name Inter 500 15px white,
  time Inter 400 14px #8E8E93 right-aligned.
  Current player row: 2px amber left border, #1C1C1E bg.

Two buttons bottom, padding 24px 16px + safe area:
  "Share Result" amber full-width 52px, Lucide "share-2" icon left.
  "Explore More Quests" #2C2C2E surface full-width 52px white label, margin-top 10px.

iPhone 15 Pro browser frame, dark mode.
```

---

## Screen 10 — Admin: Quest Dashboard (Desktop)

```
Desktop web admin panel, 1440px wide browser, light mode.
White #FFFFFF background, #F5F5F7 sidebar, Inter font throughout.

Left sidebar 240px fixed:
  Top: "TrailTale Admin" logo, Inter 700 16px #1C1C1E, amber dot accent.
  Nav items 44px height each, 16px padding, Inter 500 14px:
    "Quests" — active: amber left border 3px, #FFF8EC bg, amber text.
    "Players" — inactive: #6E6E73 text.
    "Analytics" — inactive.
    "Settings" — inactive.
  Lucide icons left of each label, 18px.

Main content area, padding 32px:
  Header row: "My Quests" Inter 700 28px #1C1C1E left.
    Right: "New Quest" button amber fill 40px height Inter 600 14px border-radius 10px,
    Lucide "plus" icon left.
  Search bar below, full width, height 40px, #F5F5F7 bg, border 1px #E5E5E7,
    border-radius 10px, Lucide "search" icon left, placeholder "Search quests".

Quest grid, 2 columns, 16px gap, margin-top 24px:
  Quest card #FFFFFF border 1px #E5E5E7, border-radius 16px, overflow hidden:
    Color band top 80px — amber gradient for Faust Quest. Quest title overlay white bold.
    Card body padding 16px:
      Quest name Inter 700 16px #1C1C1E.
      "Vienna · 6 clues" Inter 400 13px #6E6E73.
      Status badge: "Published" — #DCFCE7 bg #166534 text, border-radius 999px 6px padding.
      Bottom row: "Edit" button outline amber 32px + "View Live" ghost link #6E6E73.
  Empty card: dashed border #E5E5E7, Lucide "plus" 32px #C7C7CC center, "New Quest" #6E6E73 below.

MacBook browser frame, 1440px, light mode.
```

---

## Screen 11 — Admin: Clue List Editor (Desktop)

```
Desktop web admin, same sidebar as Screen 10, "Quests" active.
Main content padding 32px.

Breadcrumb: "Quests" #6E6E73 / "Faust Quest" #1C1C1E Inter 400 14px, chevron separator.

Quest meta row: title input "Faust Quest" inline editable, city "Vienna" badge #F5F5F7,
  language tabs "UA / EN / DE" pill group, published toggle shadcn Switch (amber when on).
Divider below.

"Clues" section header: "Clues (6)" Inter 600 16px #1C1C1E + "Add Clue" button amber right.

Clue list, full width, white card border 1px #E5E5E7 border-radius 12px:
  Each row 60px height, horizontal flex, border-bottom 1px #F5F5F7:
    Left: Lucide "grip-vertical" 16px #C7C7CC drag handle, 12px margin-right.
    Amber circle 28px with step number "1" white Inter 700 13px.
    Center: clue title Inter 500 15px #1C1C1E. Location "Basilisk Courtyard" Inter 400 13px #6E6E73 below.
    Right: code "••••••" Inter Mono 13px #6E6E73 + Lucide "eye" 14px.
      Lucide "pencil" 16px #6E6E73 + Lucide "trash-2" 16px #FF453A, 8px gap.
  Row 3 being dragged: elevated — box-shadow 0 4px 16px rgba(0,0,0,0.12), 1.5° rotation implied.

MacBook browser frame, 1440px, light mode.
```

---

## Screen 12 — Admin: Clue Editor (Desktop)

```
Desktop web admin clue editor, full form. Same sidebar, Quests active.
Main content area split two columns, 32px padding, 24px gap.

Top bar: breadcrumb "Quests / Faust Quest / Clue 1".
  Right: "Save Changes" amber button + "Discard" ghost link #6E6E73.

Left column (60% width):
  Language tab switcher: shadcn Tabs "UA / EN / DE", amber underline active.
  Under tabs, form fields stacked 20px gap:
    "Clue Title" — label Inter 500 13px #6E6E73 above, input height 40px border 1px #E5E5E7 border-radius 8px.
    "Clue Text" — same label, textarea 140px height, line-height 1.6.
    "Hint" — collapsible section, chevron toggle. Textarea 80px inside, #FFF8EC bg tint.
    "Secret Code" — label + monospace input Inter Mono, height 40px, width 200px inline.
      Lucide "eye-off" toggle right inside field. "12 / 20 chars" counter right.

Right column (40% width):
  "Location" section card #F5F5F7 border-radius 12px padding 16px:
    "Location Name" input field. Static map thumbnail 100% width, 140px height,
    border-radius 8px, pin marker amber center. "Change on map" link below amber.
  "Attempts before hint" section: label + shadcn NumberInput stepper, default 5.
  "Media" card #F5F5F7 border-radius 12px padding 24px dashed border #E5E5E7:
    Lucide "image" 32px #C7C7CC center. "Drop image or click" #6E6E73 13px below.
  "Preview as Player →" text button amber 14px Inter 600 bottom of column.

MacBook browser, 1440px, light mode.
```

---

## Screen 13 — Admin: Live Player Monitoring (Desktop)

```
Desktop web admin live monitoring. Same sidebar, "Players" nav item active.

Header: "Faust Quest — Live" Inter 700 24px #1C1C1E.
  Right of title: pulsing green dot 8px (#32D74B) + "Live" Inter 500 13px #32D74B.
  Far right: "Last updated 5s ago" Inter 400 13px #6E6E73 + Lucide "refresh-cw" 14px.

Filter pill tabs below header: "All (3) / Active (2) / Finished (1) / Stuck (1)".
  Active tab: amber fill white text. Others: #F5F5F7 bg #6E6E73 text. Border-radius 999px.

shadcn Table, white bg, border 1px #E5E5E7, border-radius 12px, margin-top 16px:
  Header row: "Team / Player" | "Progress" | "Time" | "Attempts" | "Last Active" | "Actions"
  Inter 500 12px #6E6E73 uppercase tracked. Border-bottom 2px #F5F5F7.

  Row 1 "🐺 Вовки" Inter 600 14px #1C1C1E:
    Progress: mini progress bar 120px amber 4/6 fill + "4 / 6" text. Time "47 min". Attempts "8". Last "2m ago".
    Actions: "Reset" outline amber 30px + "Skip" outline #6E6E73 30px + Lucide "trash-2" red icon. 8px gaps.

  Row 2 "👤 Solo #B7C1" — row background #FFF5F5 (stuck tint), left border 3px #FF453A:
    Progress 1/6 amber. Time "12 min". Attempts "22" — bold red #FF453A. Last "30s ago".
    Actions same pattern. Tooltip implied on row: "Stuck on Clue 1".

  Row 3 "🦊 Лисиці" — row normal:
    Progress 6/6 Lucide "check-circle" amber fill. Time "1h 12m". Attempts "11". Last "Finished".
    Actions: only Lucide "trash-2" red icon visible (no reset/skip when done).

Table has subtle row hover state #F5F5F7.
MacBook browser frame, 1440px, light mode.
```
