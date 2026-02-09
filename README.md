# AI-Powered Social Media Fraud Detection Platform

A production-grade, modular platform for detecting fake social media accounts using machine learning, behavioral analysis, and network graph signals.

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React         │────▶│   Express.js    │────▶│   FastAPI       │
│   Dashboard     │     │   Backend       │     │   ML Service    │
│   (Port 3000)   │     │   (Port 5000)   │     │   (Port 8001)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                        ┌────────▼────────┐
                        │    MongoDB      │
                        │   (Port 27017)  │
                        └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB 6.0+
- Docker & Docker Compose (optional)

### Option 1: Docker Compose (Recommended)

```bash
# Clone and start all services
docker-compose up --build

# Access the dashboard at http://localhost:3000
```

### Option 2: Local Development

**1. Start MongoDB**
```bash
mongod --dbpath /path/to/data
```

**2. Start ML Service**
```bash
cd ml_service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

**3. Start Backend Server**
```bash
cd backend_server
npm install
npm run dev
```

**4. Start Frontend Dashboard**
```bash
cd frontend_dashboard
npm install
npm start
```

## 📊 Features

- **Behavioral Analysis**: Actions per minute, session patterns, click entropy
- **Profile Authenticity**: Account age, follower ratios, profile completeness
- **Network Graph Signals**: PageRank, clustering coefficient, community detection
- **Trust Score**: Unified 0-1 score combining all signals
- **Real-time Dashboard**: Modern SaaS UI with live updates
- **Batch Processing**: Analyze multiple accounts simultaneously

## 🔧 API Endpoints

### ML Service (Port 8001)
- `GET /health` - Health check
- `POST /api/v1/detect` - Batch fraud detection

### Backend (Port 5000)
- `POST /api/auth/login` - User authentication
- `POST /api/scans` - Create new scan
- `GET /api/scans` - List all scans
- `GET /api/dashboard/stats` - Dashboard statistics

## 📁 Project Structure

```
fake_accnt_detection/
├── ml_service/           # Python FastAPI ML microservice
├── backend_server/       # Node.js Express backend
├── frontend_dashboard/   # React dashboard
├── docker-compose.yml    # Docker orchestration
└── README.md
```

## 🔐 Environment Variables

Copy `.env.example` to `.env` in each service directory and configure:

| Variable | Description |
|----------|-------------|
| MONGODB_URI | MongoDB connection string |
| ML_SERVICE_URL | ML microservice URL |
| JWT_SECRET | JWT signing secret |

## 📈 Model Details

- **Random Forest Classifier**: Supervised learning for fraud prediction
- **Isolation Forest**: Unsupervised anomaly detection
- **Ensemble**: Weighted combination (RF: 0.6, IF: 0.4)

## 📄 License

MIT License
