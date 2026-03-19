# FaceNRoll

FaceNRoll is a full-stack face-recognition attendance platform with three coordinated services:

- **React frontend** for user registration, face capture, recognition, and admin views
- **Express + MongoDB backend** for user data, attendance records, analytics, exports, and email workflows
- **Flask + TensorFlow service** for face validation, embedding generation, and recognition

## Features

- User sign-up and login
- Face-based user registration with multi-pose capture
- Face validation before registration submission
- Face recognition and attendance marking
- Daily attendance details and export (CSV/PDF)
- Attendance analytics dashboards (status, progress, daily/weekly/monthly trends)
- Email notifications for attendance and registration flows

## Architecture

```text
Frontend (React, localhost:3000)
        |
        | HTTP
        v
Backend API (Express, localhost:5000) <----> MongoDB
        |
        | HTTP
        v
Face Service (Flask, localhost:5001)
```

The frontend calls both APIs directly:
- `http://localhost:5000` (Express)
- `http://localhost:5001` (Flask)

## Project Structure

```text
FaceNRoll/
├── frontend/        # React client
├── Database/        # Express + MongoDB API
├── Python/          # Flask + TensorFlow face service
├── facenroll-finetune.ipynb
└── README.md
```

## Prerequisites

- **Node.js** 18+ (or modern Node LTS)
- **npm**
- **Python** 3.9+
- **MongoDB** instance (local or cloud)

## Environment Configuration

Create `Database/.env` from the repository root:

```env
PORT=5000
MONGODB_URI=<your_mongodb_connection_string>
EMAIL_USER=<gmail_address>
EMAIL_PASS=<gmail_app_password>
```

Notes:
- `MONGODB_URI`, `EMAIL_USER`, and `EMAIL_PASS` are required by the backend.
- The Flask service defaults to port `5001` in `Python/app.py`.

## Installation

Install dependencies for frontend and backend:

```bash
cd frontend
npm install

cd ../Database
npm install
```

Install Python dependencies (manually, because no `requirements.txt` is currently provided):

```bash
cd Python
pip install flask flask-cors tensorflow opencv-python mediapipe scipy numpy pandas
```

## Running the Application

### Option A: Start all services from the frontend (recommended for local development)

```bash
cd frontend
npm start
```

This runs:
- React app (`react-scripts start`)
- Express backend (`../Database/index.js`)
- Flask face service (`../Python/app.py`)

### Option B: Start services independently

**Frontend**
```bash
cd frontend
npm run start-react
```

**Backend**
```bash
cd Database
npm start
```

**Python face service**
```bash
cd Python
python app.py
```

## Available Scripts

### Frontend (`frontend/package.json`)
- `npm start` – start frontend + backend + Python service concurrently
- `npm run build` – production build for React app
- `npm test` – run React tests

### Backend (`Database/package.json`)
- `npm start` – start Express server
- `npm run dev` – start with nodemon
- `npm run build` – placeholder (no build step)
- `npm test` – currently placeholder and exits with error (`no test specified`)

## Key API Endpoints

### Backend (Express, `localhost:5000`)
- `POST /signup` – create platform user
- `POST /login` – authenticate user
- `POST /register` – register person with captured face images
- `POST /mark-attendance` – mark attendance event
- `GET /all-attendance` – retrieve attendance list
- `GET /attendance-summary` – summary for selected date
- `GET /attendance-analytics` – analytics aggregation
- `GET /export-attendance` – attendance export
- `GET /export-attendanceanalyze` – analytics export

### Face Service (Flask, `localhost:5001`)
- `POST /api/validate-faces` – validate face capture quality
- `POST /api/process-images` – generate face embeddings from registration images
- `POST /api/recognize-face` – recognize captured face against embeddings
- `GET /api/status` – health/status endpoint

## Development Notes

- Frontend currently uses hard-coded API URLs for `localhost:5000` and `localhost:5001`.
- TensorFlow model/data artifacts are intentionally ignored by Git (`Python/resnet50_model`, `Python/face_embeddings.pkl`, `Python/temp_faces`, etc.).
- If email sending is enabled, use a Gmail app password in `EMAIL_PASS`.

## Troubleshooting

- **MongoDB connection errors**: verify `MONGODB_URI` in `Database/.env`.
- **Email send failures**: verify `EMAIL_USER` and app password (`EMAIL_PASS`).
- **Flask startup/import errors**: ensure Python packages are installed in the active environment.
- **Face service unavailable**: check `http://localhost:5001/api/status`.
- **Frontend build/test warnings**: existing project lint/test issues may fail CI-like runs when warnings are treated as errors.

## Future Improvements

- Add `requirements.txt` for reproducible Python dependency setup
- Add backend and Python automated tests
- Move frontend API base URLs to environment variables
- Add deployment-focused documentation for production environments
