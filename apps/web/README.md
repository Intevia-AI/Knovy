# Intevia AI Web Application

> [!IMPORTANT]
> This document is AI generated. Please verify the information before using it.

A modern Next.js web application that provides AI-powered real-time audio analysis and transcription services. Built with React, TypeScript, and Google Gemini AI, this application offers a comprehensive demo interface and landing page for the Intevia AI platform.

## Overview

The Intevia AI Web Application serves as both a marketing landing page and a functional demo platform for real-time AI-powered audio analysis. Users can share their screen, record audio from multiple sources, and receive intelligent transcription, analysis, and contextual responses powered by Google's Gemini AI.

### Key Features

- **Interactive Demo Interface**: Full-featured demo with screen sharing and audio recording
- **Real-time AI Analysis**: Live transcription and keyword extraction from audio streams
- **Multi-source Audio Capture**: Simultaneous microphone and system audio recording
- **AI-powered Interactions**: Answer questions, generate summaries, and search topics based on audio content
- **Audio Visualization**: Real-time visual feedback for microphone and system audio levels
- **Responsive Landing Page**: Modern marketing site with team information and feature highlights
- **Email Integration**: Contact form with Gmail SMTP integration
- **API Endpoints**: RESTful APIs for AI processing and feedback collection

### Technology Stack

- **Next.js 15**: React framework with App Router and static generation
- **React 19**: Modern React with hooks and concurrent features
- **TypeScript**: Type-safe development with strict type checking
- **Google Gemini AI**: Advanced AI processing with search grounding
- **Web Audio API**: Real-time audio processing and visualization
- **MediaRecorder API**: Browser-native audio recording capabilities
- **Tailwind CSS**: Utility-first CSS framework via workspace UI components
- **Nodemailer**: Email sending capabilities with Gmail integration

## Prerequisites

Before setting up the development environment, ensure you have:

- **Node.js** (v18 or higher)
- **pnpm** (v8 or higher) - Package manager
- **Git** - Version control
- **Google AI API Key** - For Gemini AI integration
- **Gmail App Password** - For email functionality (optional)

## Installation & Setup

### 1. Clone and Install Dependencies

```bash
# Navigate to the web directory
cd apps/web

# Install dependencies
pnpm install
```

### 2. Environment Configuration

```bash
# Copy the environment template
cp .env.example .env

# Edit the .env file with your configuration
# Required variables:
# - GOOGLE_GENERATIVE_AI_API_KEY: Your Google AI API key
# - GMAIL_USER: Gmail account for feedback emails (optional)
# - GMAIL_PASS: Gmail app password (optional)
# - PROXY_SERVER_URL: WebSocket proxy server URL
# - NODE_ENV: Environment mode (development/production)
```

### 3. Google AI API Setup

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key or use an existing one
3. Add the key to your `.env` file as `GOOGLE_GENERATIVE_AI_API_KEY`

### 4. Gmail Configuration (Optional)

For the contact form to work:

1. Enable 2-factor authentication on your Gmail account
2. Generate an app-specific password:
   - Google Account > Security > 2-Step Verification > App passwords
3. Add your Gmail address and app password to `.env`

## Development

### Running in Development Mode

```bash
# Start the development server
pnpm dev

# The application will be available at:
# http://localhost:3000
```

### Development Workflow

1. **Landing Page**: Modify files in `app/(landing)/` for marketing content
2. **Demo Interface**: Update `components/demo.tsx` for demo functionality
3. **API Routes**: Modify files in `app/api/` for backend functionality
4. **Components**: Update shared components in `components/`
5. **Styling**: Use Tailwind classes and workspace UI components

### Project Structure

```
apps/web/
├── app/                          # Next.js App Router
│   ├── (landing)/               # Landing page routes
│   │   ├── page.tsx            # Main landing page
│   │   ├── privacy/            # Privacy policy
│   │   └── terms/              # Terms of service
│   ├── api/                    # API routes
│   │   ├── ai/                 # AI processing endpoints
│   │   ├── feedback/           # Contact form handler
│   │   └── process-audio/      # Audio processing utilities
│   ├── auth/                   # Authentication pages
│   └── layout.tsx              # Root layout
├── components/                 # React components
│   ├── demo.tsx               # Main demo interface
│   ├── hero-section.tsx       # Landing page hero
│   ├── features.tsx           # Features showcase
│   ├── team.tsx               # Team information
│   └── logos/                 # Brand logos
├── hooks/                     # Custom React hooks
├── lib/                       # Utility libraries
├── utils/                     # Utility functions
├── public/                    # Static assets
└── package.json               # Dependencies and scripts
```

### Key Development Files

- **`components/demo.tsx`**: Main demo interface with screen sharing and AI interaction
- **`app/api/ai/route.ts`**: Primary AI processing endpoint
- **`hooks/useSegmentRecorder.ts`**: Custom hook for audio recording and segmentation
- **`components/AudioVisualizer.tsx`**: Real-time audio visualization component
- **`app/(landing)/page.tsx`**: Main landing page with marketing content

## API Endpoints

### POST /api/ai

Primary AI processing endpoint for chat interactions and audio analysis.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Analyze this audio content"
    }
  ],
  "data": {
    "audioInputs": [
      {
        "data": "base64-encoded-audio-data",
        "mimeType": "audio/webm;codecs=opus",
        "label": "microphone-current"
      }
    ]
  }
}
```

**Response:**
```json
{
  "id": "ai-1626984512345",
  "role": "assistant",
  "content": "Analysis results and response..."
}
```

### POST /api/feedback

Contact form submission endpoint.

**Request Body:**
```json
{
  "name": "User Name",
  "email": "user@example.com",
  "message": "Feedback message"
}
```

### POST /api/process-audio

Audio processing utilities for format conversion and analysis.

## Building & Deployment

### Development Build

```bash
# Build the application
pnpm build

# Start production server locally
pnpm start
```

### Production Deployment

The application can be deployed to various platforms:

#### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel

# Set environment variables in Vercel dashboard
```

#### Docker Deployment

```bash
# Build Docker image
docker build -t intevia-web .

# Run container
docker run -p 3000:3000 --env-file .env intevia-web
```

#### Static Export (Optional)

For static hosting without server-side features:

```bash
# Configure next.config.mjs for static export
# Add: output: 'export'

# Build static version
pnpm build

# Deploy 'out' directory to static hosting
```

### Environment Variables for Production

Ensure all required environment variables are set in your production environment:

- `GOOGLE_GENERATIVE_AI_API_KEY`: Your Google AI API key
- `NODE_ENV`: Set to "production"
- `GMAIL_USER` and `GMAIL_PASS`: For email functionality
- `PROXY_SERVER_URL`: Production WebSocket proxy URL (wss://)

## Testing

### Manual Testing

```bash
# Start development server
pnpm dev

# Test key features:
# 1. Landing page loads correctly
# 2. Demo interface screen sharing works
# 3. Audio recording and visualization
# 4. AI responses and transcription
# 5. Contact form submission
# 6. Responsive design on mobile
```

### Automated Testing

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Fix linting issues
pnpm lint:fix

# Note: Add unit tests for components and API routes as needed
```

### Performance Testing

- **Lighthouse**: Test performance, accessibility, and SEO
- **Web Vitals**: Monitor Core Web Vitals metrics
- **Audio Performance**: Test with different audio sources and durations

## Deployment Considerations

### Performance Optimization

- **Image Optimization**: Use Next.js Image component for optimized loading
- **Code Splitting**: Leverage Next.js automatic code splitting
- **Bundle Analysis**: Use `@next/bundle-analyzer` to optimize bundle size
- **Caching**: Configure appropriate cache headers for static assets

### Security

- **API Rate Limiting**: Implement rate limiting for API endpoints
- **Input Validation**: Validate all user inputs and file uploads
- **CORS Configuration**: Configure CORS headers appropriately
- **Environment Variables**: Never expose sensitive keys in client-side code

### Monitoring

- **Error Tracking**: Implement error tracking (e.g., Sentry)
- **Analytics**: Add analytics tracking for user interactions
- **Performance Monitoring**: Monitor API response times and errors
- **Audio Quality**: Monitor transcription accuracy and processing times

## Troubleshooting

### Common Issues

#### AI API Errors
```bash
# Check API key validity
# Verify Google AI Studio quota and billing
# Check network connectivity and CORS settings
```

#### Audio Recording Issues
```bash
# Verify browser permissions for microphone and screen sharing
# Check MediaRecorder API support in target browsers
# Test with different audio formats and codecs
```

#### Build Failures
```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules
pnpm install

# Check TypeScript errors
pnpm typecheck
```

#### Email Functionality
```bash
# Verify Gmail app password is correct
# Check Gmail SMTP settings and 2FA configuration
# Test email sending in development environment
```

### Debug Mode

```bash
# Enable Next.js debug mode
DEBUG=* pnpm dev

# Enable verbose logging for specific modules
DEBUG=nodemailer* pnpm dev
```

### Performance Issues

- **Large Audio Files**: Implement chunking for large audio uploads
- **Memory Usage**: Monitor memory consumption during audio processing
- **API Response Times**: Optimize AI API calls and implement caching
- **Bundle Size**: Analyze and optimize JavaScript bundle size

## Contributing

When contributing to the web application:

1. **Follow Next.js best practices** for App Router and server components
2. **Add TypeScript types** for all new interfaces and components
3. **Test audio functionality** across different browsers and devices
4. **Update API documentation** for new endpoints
5. **Ensure responsive design** works on mobile and desktop
6. **Add error handling** for all user interactions

## Security Considerations

- **API Key Protection**: Never expose Google AI API key in client-side code
- **Input Sanitization**: Sanitize all user inputs before processing
- **File Upload Security**: Validate audio file types and sizes
- **Rate Limiting**: Implement rate limiting for API endpoints
- **HTTPS**: Always use HTTPS in production for secure data transmission

## Related Documentation

- [Main Project README](../../README.md)
- [Electron App](../app/README.md)
- [Proxy Server](../proxy/README.md)
- [Development Setup Guide](../../docs/setup/development.md)
- [Architecture Overview](../../docs/architecture/overview.md)
- [API Reference](../../docs/architecture/api-reference.md)