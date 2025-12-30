# Orb System UI Behavior

> Guidelines for implementing the Orb-based Ad Intelligence UI

## Lane Separation

The UI must separate ads into two distinct lanes:

### Your Ads Lane
- **Content**: Orbs with state `published` or `observed`
- **Source**: User-created or imported ads
- **Actions**: Edit, view results, archive

### AI Suggestions Lane
- **Content**: Orbs with state `suggested`
- **Source**: AI-generated suggestions
- **Actions**: Create Draft (converts to draft), Dismiss

## Suggested Orb Card

Each suggested orb card must display:

```
┌──────────────────────────────────────────┐
│ 🤖 SUGGESTED                             │
├──────────────────────────────────────────┤
│ Predicted Score: 72%                     │
│ Confidence: Medium (58%)                 │
├──────────────────────────────────────────┤
│ ✓ What's Proven:                         │
│   • UGC style adds +12 points            │
│   • Subtitles add +8 points              │
│   • Top similar ads avg 75%              │
├──────────────────────────────────────────┤
│ 🧪 What's Being Tested:                  │
│   Voiceover: Testing on vs off           │
├──────────────────────────────────────────┤
│ 💡 Why Suggested:                        │
│   Low data on voiceover impact           │
│   (only 3 examples, 40% uncertainty)     │
├──────────────────────────────────────────┤
│ [Create Draft]  [Dismiss]                │
└──────────────────────────────────────────┘
```

## Lifecycle Transition Buttons

| Current State | Available Actions |
|---------------|-------------------|
| `suggested`   | "Create Draft", "Dismiss" |
| `draft`       | "Publish", "Edit", "Delete" |
| `published`   | "Add Results", "Edit" |
| `observed`    | "View Analysis", "Archive" |

## Badge Styling

| State       | Badge Color | Badge Text |
|-------------|-------------|------------|
| `suggested` | Purple      | "AI Suggestion" |
| `draft`     | Gray        | "Draft" |
| `published` | Blue        | "Live" |
| `observed`  | Green       | "Results" |

## Safety Rules (NEVER Violate)

1. **No Auto-Publish**: User must explicitly click "Publish"
2. **No Embedding Display**: Never show raw embedding vectors
3. **No Neighbor Exposure**: Don't show actual neighbor ad data
4. **Confirm Before Delete**: Always confirm destructive actions
5. **Preserve Lineage**: Show "Based on: [parent ad]" when applicable

## Confidence Indicators

| Confidence | Visual | Label |
|------------|--------|-------|
| 80-100%    | 🟢     | High |
| 60-79%     | 🟡     | Medium |
| 40-59%     | 🟠     | Low |
| 0-39%      | 🔴     | Very Low |

## Data Gap Alerts

When confidence is low, show data gap suggestions:

```
⚠️ Limited Data Available

More data would help for:
• voiceover (3 examples)
• jingle audio (1 example)

Consider running this experiment to improve future predictions.
```

## Mobile Considerations

- Stack lanes vertically on mobile
- Collapse "What's Proven" section by default
- Use swipe gestures for card actions
- Ensure touch targets are 44x44px minimum
