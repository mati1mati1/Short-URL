# Short URL Service

A high-performance, production-ready URL shortening service built with Node.js, TypeScript, and microservices architecture. Features comprehensive observability, caching, and scalable design.

## 🚀 Features

### Core Functionality
- **Link Shortening**: Create short, memorable URLs from long URLs
- **Fast Redirects**: Optimized redirect service with Redis caching (P95 ≤ 50ms cache hit)
- **Link Management**: Full CRUD operations for link management
- **Expiration Support**: Set expiration dates for links
- **Active/Inactive Toggle**: Enable/disable links without deletion

### Performance & Scalability
- **Redis Caching**: Sub-50ms redirects with intelligent cache management
- **Database Optimization**: PostgreSQL with proper indexing and connection pooling
- **Microservices Architecture**: Separate API and redirect services for optimal scaling
- **Horizontal Scaling**: Stateless services ready for load balancing

### Observability & Monitoring
- **Structured Logging**: JSON-formatted logs with Pino
- **Distributed Tracing**: OpenTelemetry integration across services
- **Metrics Collection**: Prometheus metrics with custom business metrics
- **File-based Logging**: Persistent logs with web-based log viewer
- **Health Checks**: Monitoring endpoints for service health

### Security & Validation
- **Input Validation**: Comprehensive validation with Zod schemas
- **Rate Limiting**: Protection against abuse
- **IP Tracking**: Hashed IP storage for analytics
- **URL Validation**: Strict URL format validation

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐
│  Redirect       │    │  API Service    │
│  Service        │◄──►│  (Port 3000)    │
│  (Port 8081)    │    │                 │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌─────────────────┐    ┌─────────────────┐
         │  Redis Cache    │    │  PostgreSQL     │
         │  (Port 6379)    │    │  (Port 5432)    │
         └─────────────────┘    └─────────────────┘
```

### Services Overview

#### Redirect Service (`/services/redirect-service`)
- Handles `GET /:slug` requests for URL redirection
- Optimized for read-heavy workloads
- Redis-first caching strategy
- Comprehensive request logging and metrics

#### API Service (`/services/api-service`)
- RESTful API for link management
- Handles link creation, updates, and deletion
- Web-based log viewer interface
- Metrics and health endpoints

#### Observability Package (`/packages/observability`)
- Shared logging, tracing, and metrics utilities
- Custom Pino logger with file output
- OpenTelemetry tracing configuration
- Reusable across all services

## 🛠️ Technology Stack

- **Runtime**: Node.js with TypeScript
- **Web Framework**: Express.js
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Logging**: Pino with structured JSON output
- **Validation**: Zod schemas
- **Tracing**: OpenTelemetry
- **Metrics**: Prometheus (prom-client)
- **Testing**: Vitest with coverage
- **Containerization**: Docker & Docker Compose
- **Migration**: node-pg-migrate

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- npm 10+

### Setup and Run

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Short
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start all services**
   ```bash
   docker-compose up --build
   ```

4. **Run database migrations**
   ```bash
   docker-compose run migrations-service
   ```

### Services will be available at:
- **API Service**: http://localhost:3000
- **Redirect Service**: http://localhost:8081
- **Log Viewer**: http://localhost:3000/logs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 📖 API Documentation

### Create Short Link
```bash
POST http://localhost:3000/links
Content-Type: application/json

{
  "target_url": "https://example.com/very-long-url",
  "expires_at": "2025-12-31T23:59:59Z",
  "title": "Optional title"
}
```

**Response:**
```json
{
  "slug": "abc123x",
  "target_url": "https://example.com/very-long-url",
  "created_at": "2024-01-15T10:30:00Z",
  "expires_at": "2025-12-31T23:59:59Z",
  "is_active": true
}
```

### Use Short Link
```bash
GET http://localhost:8081/abc123x
# → 302 Redirect to target_url
```

### Get Link Details
```bash
GET http://localhost:3000/links/abc123x
```

### Update Link
```bash
PATCH http://localhost:3000/links/abc123x
Content-Type: application/json

{
  "is_active": false,
  "expires_at": "2024-12-31T23:59:59Z"
}
```

### List All Links
```bash
GET http://localhost:3000/links
```

### Delete Link
```bash
DELETE http://localhost:3000/links/abc123x
```

## 📊 Monitoring & Observability

### Metrics Endpoints
- **API Service Metrics**: http://localhost:3000/metrics
- **Redirect Service Metrics**: http://localhost:8081/metrics

### Health Checks
- **API Health**: http://localhost:3000/health
- **Redirect Health**: http://localhost:8081/healthz

### Log Viewer
Access the web-based log viewer at http://localhost:3000/logs to:
- View real-time logs from both services
- Download log files
- Filter and search through log entries
- Monitor request flows and errors

### Log Files
Service logs are persisted to:
- API Service: `/app/logs/api-service.log`
- Redirect Service: `/app/logs/redirect-service.log`

## 🧪 Testing

```bash
# Run tests for API service
cd services/api-service
npm test

# Run tests with coverage
npm run test:cov

# Watch mode for development
npm run test:watch
```

## 🔧 Development

### Local Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start databases only**
   ```bash
   docker-compose up db redis -d
   ```

3. **Run migrations**
   ```bash
   cd services/migrations-service
   npm run migrate up
   ```

4. **Start services in development mode**
   ```bash
   # Terminal 1 - API Service
   cd services/api-service
   npm run dev

   # Terminal 2 - Redirect Service
   cd services/redirect-service
   npm run dev
   ```

### Project Structure
```
├── services/
│   ├── api-service/          # Main API service
│   ├── redirect-service/     # URL redirection service
│   └── migrations-service/   # Database migrations
├── packages/
│   └── observability/        # Shared observability utilities
├── docker/                   # Docker configuration
├── docs/                     # Documentation
└── docker-compose.yml        # Multi-service orchestration
```

## 🏭 Production Deployment

### Performance Targets
- **Redirect Latency**: P95 ≤ 50ms (cache hit), ≤ 150ms (cache miss)
- **Availability**: 99.9%
- **Throughput**: 1-2k RPS redirects, 50 RPS link creation
- **Capacity**: 10M+ links

### Environment Variables
Key configuration options:

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=shorturl
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Services
API_PORT=3000
REDIRECT_PORT=8081
API_BASE_URL=http://api:3000

# Timeouts
API_TIMEOUT_MS=5000
CACHE_TTL_HOURS=24
```

### Scaling Considerations
- **Horizontal Scaling**: Both services are stateless and can be scaled horizontally
- **Database**: Use connection pooling and read replicas for higher loads
- **Cache**: Redis cluster for distributed caching
- **Load Balancing**: Deploy behind load balancer with health checks

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 🆘 Troubleshooting

### Common Issues

**Services not starting:**
- Check Docker logs: `docker-compose logs [service-name]`
- Verify environment variables are set correctly
- Ensure ports 3000, 8081, 5432, 6379 are available

**Database connection errors:**
- Wait for PostgreSQL to be ready before starting services
- Run migrations: `docker-compose run migrations-service`
- Check database credentials in `.env`

**Cache misses:**
- Verify Redis is running: `docker-compose ps redis`
- Check Redis connectivity from services
- Monitor cache hit rates in metrics

**Log files not appearing:**
- Verify Docker volumes are mounted correctly
- Check service startup logs for file permission errors
- Ensure `/app/logs` directory is writable

### Support
For issues and questions, please check the [documentation](docs/) or create an issue in the repository.
