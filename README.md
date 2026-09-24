# SoulSensei Leader Booking Portal

A dedicated, lightweight web portal for SoulSensei leaders to view learners who had 1:1 sessions with them and schedule follow-up appointments directly into the centralized Google Sheet.

Synced with Google Sheet: [Leader Pitch Sheet](https://docs.google.com/spreadsheets/d/1q-gadAgzT7Rim6p_3GvIPwTj_nznz_IkGrzLG3XP6NI/edit)

---

## Features

1. **Leader Authentication**:
   - Leaders select their name from a verified list.
   - Enter their secure 4-digit PIN (last 4 digits of their registered phone number, or `8888` if phone is not on file).
   - Instant validation against `Sheet 1`.

2. **Learner Selection**:
   - After authentication, leaders see a dropdown of learners who have sessions with them on today's schedule.
   - Shows learner name, user ID, offering/session type, and original session time.

3. **Appointment Scheduling**:
   - Pick appointment date and time (IST).
   - Add optional follow-up notes or session objectives.
   - Saves instantly to the **`Scheduled Appointments`** tab in the same Google Sheet.

4. **Live Scheduled Appointments View**:
   - Real-time display of all appointments already booked by the leader.

---

## Project Structure

```
booking-portal/
├── app.py                      # Flask API & application server
├── config.py                   # Environment and Google Sheets configuration
├── requirements.txt            # Python dependencies
├── .env.example                # Example environment configuration
├── .gitignore                  # Git ignore rules (protects credentials)
├── static/
│   ├── css/
│   │   └── style.css           # Modern SoulSensei styling and responsive layout
│   └── js/
│       └── app.js              # Frontend interactive application logic
└── templates/
    └── index.html              # Single page application template
```

---

## Setup & Running

### Prerequisites
- Python 3.9+
- Google Cloud Service Account with access to the target Google Sheet

### Installation

1. **Clone repository**:
   ```bash
   git clone https://github.com/utsav-soulsensei/booking-portal.git
   cd booking-portal
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Set your Google Sheet ID and service account credentials:
   ```ini
   SPREADSHEET_ID=1q-gadAgzT7Rim6p_3GvIPwTj_nznz_IkGrzLG3XP6NI
   SERVICE_ACCOUNT_PATH=/path/to/service-account.json
   PORT=5000
   ```
   *(Note: For hosted environments like Render/Vercel, you can pass `GOOGLE_SERVICE_ACCOUNT_JSON` containing the full JSON credentials string instead of a file path.)*

4. **Start the Application**:
   ```bash
   python3 app.py
   ```
   Access the portal at `http://localhost:5000`.

---

## API Endpoints

- `GET /api/leaders`: Fetches the list of active leaders from `Sheet 1`.
- `POST /api/login`: Authenticates leader with `{ "leader_name": "...", "password": "..." }` and returns their learners.
- `POST /api/schedule`: Records appointment to `Scheduled Appointments` tab.
- `GET /api/appointments?leader=<name>`: Retrieves scheduled appointments for a leader.
