# Math Questions Practice System

A full-stack application for practicing math questions, now refactored into separate frontend and backend projects.

## Project Structure

```
astro-project/
├── backend/          # Express.js API server
├── frontend/         # Astro.js web application
└── README.md         # This file
```

## Quick Start

### 1. Start the Backend
```bash
cd backend
npm install
npm run dev
```
Backend runs on http://localhost:3001

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on http://localhost:4321

## Architecture

### Backend (Express.js + Node.js)
- **Port**: 3001
- **Features**:
  - RESTful API for question management
  - Question image serving
  - CORS enabled for frontend
  - Rate limiting and security headers
  - JSON file-based data storage

### Frontend (Astro.js)
- **Port**: 4321
- **Features**:
  - Math practice interface
  - Timer functionality
  - Question completion tracking
  - Responsive design with dark mode
  - Topic-based filtering

## API Endpoints

### Questions API
- `GET /api/questions` - Get random question or filter by topic/difficulty
- `GET /api/questions/all` - Get all questions (admin)
- `GET /api/questions/:id` - Get specific question
- `PATCH /api/questions/:id` - Update question (mark complete)
- `POST /api/questions/reset` - Reset all questions to incomplete

### Static Files
- `GET /questions/*` - Serve question images

## Development

### Adding Questions
Edit `backend/data/questions.json` and add question images to `backend/public/questions/`

### Frontend Configuration  
Update `BACKEND_URL` in `frontend/src/pages/maths/practice/[id].astro` if backend runs on different port.

### Production Deployment
1. Build frontend: `cd frontend && npm run build`
2. Deploy backend as Node.js service
3. Configure production URLs and CORS settings
4. Serve frontend static files (e.g., via Nginx, Vercel, Netlify)

## Technologies Used

- **Backend**: Express.js, Node.js, CORS, Helmet
- **Frontend**: Astro.js, TypeScript, Tailwind CSS
- **Development**: Nodemon for backend hot-reload
- **Data**: JSON files for question storage
