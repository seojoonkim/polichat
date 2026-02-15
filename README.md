# Polichat

A real-time chat application for Polymarket trading communities.

## Features

- Real-time chat powered by React and modern web technologies
- Polymarket integration for trading discussions
- User authentication and profiles
- Image sharing and message reactions
- Responsive design for mobile and desktop

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS 4
- **Backend:** Supabase
- **AI Integration:** Anthropic Claude, OpenAI
- **Storage:** Vercel Blob
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
```

## Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run collect` - Collect chat data
- `npm run migrate:identity` - Run identity migration
- `npm run migrate:sql` - Run SQL migrations

## Deployment

This project is configured for Vercel deployment:

```bash
vercel
```

## License

MIT

## Author

seojoonkim
