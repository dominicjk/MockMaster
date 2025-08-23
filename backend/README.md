# Math Questions Backend API

RESTful API for managing math practice questions.

## Setup

```bash
cd backend
npm install
npm run dev
```

The server will start on http://localhost:3001

## API Endpoints

### Questions
- `GET /api/questions` - Get random question (supports query filters)
- `GET /api/questions/all` - Get all questions
- `GET /api/questions/:id` - Get specific question
- `PATCH /api/questions/:id` - Update question (mark complete)
- `POST /api/questions/reset` - Reset all questions to incomplete

### Query Parameters (for GET /api/questions)
- `id` - Get specific question by ID
- `topic` - Filter by topic (e.g., "algebra")
- `level` - Filter by level (e.g., "lc") 
- `difficulty` - Filter by difficulty level (1-3)
- `onlyIncomplete` - Only return incomplete questions (true/false)

### Static Files
- Question images served from `/questions/*`

## Example Usage

```javascript
// Get random algebra question
fetch('http://localhost:3001/api/questions?topic=algebra&onlyIncomplete=true')

// Mark question as complete
fetch('http://localhost:3001/api/questions/alg-0001', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ complete: true })
})
```
