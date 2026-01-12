# Social Media Drafts

A clean, professional social media content drafting and organization app for content creators and agencies.

## Features

### Drafting Interface
- Real-time character counters for each platform:
  - Twitter/X: 280 characters
  - LinkedIn: 3000 characters
  - Instagram: 2200 characters
  - TikTok: 2200 characters
- Visual progress bar with color-coded warnings
- Auto-save functionality (saves every 2 seconds)
- Tag system for categorization
- Status labels: Draft, Ready to Post, Posted

### Draft Library
- Organized card-based layout
- Search through all content
- Filter by platform, status, or tags
- Sort by most recently updated
- Quick edit and delete actions

### Design
- Custom dark theme with warm amber accents
- No generic blue/purple gradients
- Professional agency-ready interface
- Responsive grid layout

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Storage**: localStorage (database-ready architecture)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
social-media-drafts/
├── app/
│   ├── page.tsx           # Library view (main page)
│   ├── draft/
│   │   └── page.tsx       # Draft editor
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── CharacterCounter.tsx
│   ├── DraftCard.tsx
│   ├── FilterBar.tsx
│   ├── SearchBar.tsx
│   └── TagInput.tsx
└── lib/
    ├── constants.ts       # Character limits, labels
    ├── hooks.ts           # Custom hooks (debounce)
    ├── storage.ts         # localStorage utilities
    └── types.ts           # TypeScript definitions
```

## Future Enhancements

- Database integration (PostgreSQL/MongoDB)
- User authentication
- Team collaboration features
- Direct posting to platforms via APIs
- Content calendar view
- Analytics and performance tracking
