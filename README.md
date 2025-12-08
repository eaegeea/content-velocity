# Content Velocity Clay Integration

An HTTP API integration for Clay that analyzes blog content velocity using the Anchor Browser API. This service scrapes blog posts from websites and compares publishing frequency between the last 30 days and the previous 30 days.

## Features

- 🔍 Automatically finds and scrapes blog posts from any website
- 📊 Calculates content velocity metrics (last 30 days vs previous 30 days)
- 📈 Provides percentage change and velocity status
- 🚀 Ready to deploy on Railway
- 🔌 Clay-compatible HTTP API endpoint

## Setup

### Prerequisites

- Node.js 18+ 
- Anchor Browser API key ([Get one here](https://anchorbrowser.io))

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file:
   ```env
   ANCHOR_API_KEY=your_anchor_api_key_here
   PORT=3000
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Start the server:
   ```bash
   npm start
   ```

For development:
```bash
npm run dev
```

## API Endpoints

### POST `/analyze-velocity`

Analyzes content velocity for a given website.

**Request Body:**
```json
{
  "website_url": "example.com"
}
```

**Response:**
```json
{
  "domain": "example.com",
  "blog_title": "Example Blog",
  "last_30_days_count": 12,
  "previous_30_days_count": 8,
  "velocity_status": "Velocity up",
  "percentage_change": 50
}
```

**Response Fields:**
- `domain`: The analyzed domain
- `blog_title`: Title of the blog (if found)
- `last_30_days_count`: Number of posts published in the last 30 days
- `previous_30_days_count`: Number of posts published in the previous 30 days (31-60 days ago)
- `velocity_status`: "Velocity up", "Velocity down", or "No change"
- `percentage_change`: Percentage change between the two periods

### GET `/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Clay Integration

To use this in Clay:

1. Deploy this service to Railway (see Deployment section)
2. In Clay, create a new HTTP API integration
3. Use the endpoint: `https://your-railway-app.railway.app/analyze-velocity`
4. Map the `website_url` column from your Clay table
5. The response will populate the velocity metrics columns

## Deployment to Railway

1. Push your code to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repository
4. Add the environment variable:
   - `ANCHOR_API_KEY`: Your Anchor Browser API key
5. Railway will automatically detect the Node.js project and deploy

The `PORT` environment variable is automatically set by Railway.

## How It Works

1. **Blog Discovery**: Uses Anchor Browser API to visit the domain and find the blog section
2. **Post Scraping**: Scrapes the last 60 blog posts with their titles and publish dates
3. **Velocity Calculation**: Compares posts published in:
   - Last 30 days (current period)
   - Previous 30 days (31-60 days ago)
4. **Metrics**: Calculates percentage change and determines velocity status

## Error Handling

The API handles various error scenarios:
- Invalid or missing website URLs
- Websites without blogs
- API timeouts (5 minute timeout)
- Parsing errors

All errors return appropriate HTTP status codes with descriptive messages.

## License

MIT

