# SoulSensei Leader Booking Portal

A dedicated web portal for SoulSensei leaders to view learners who have 1:1 sessions with them and schedule follow-up appointments directly into the centralized Google Sheet.

- **Live GitHub Pages URL**: [https://utsav-soulsensei.github.io/booking-portal/](https://utsav-soulsensei.github.io/booking-portal/)
- **Synced Google Sheet**: [Leader Pitch Sheet](https://docs.google.com/spreadsheets/d/1q-gadAgzT7Rim6p_3GvIPwTj_nznz_IkGrzLG3XP6NI/edit#gid=0)

---

## Features

1. **Leader Authentication**:
   - Leaders select their name from the active leader list.
   - Enter their secure 4-digit PIN (the last 4 digits of their registered phone number, or `8888` if phone is not on file).
   - Validated instantly in real-time.

2. **Learner Selection**:
   - Displays all learners who have sessions with this leader on today's schedule.
   - Shows learner name, user ID, offering/session type, and original session time.

3. **Appointment Scheduling**:
   - Select appointment date and time (IST).
   - Add optional follow-up notes or session objectives.
   - Saves into the **`Scheduled Appointments`** tab in the same Google Sheet.

4. **Live Scheduled Appointments View**:
   - Real-time display of all appointments already booked by the leader.

---

## Project Structure

```
booking-portal/
├── index.html                  # Main SPA entrypoint (served by GitHub Pages)
├── style.css                   # SoulSensei design system styling
├── app.js                      # Client-side logic & live Google Sheets sync
├── google-apps-script.js       # Optional Apps Script webhook for direct sheet writing
├── app.py                      # Optional local Flask server
├── config.py                   # Server configuration
├── requirements.txt            # Python dependencies (for local server)
├── .env.example                # Example environment configuration
└── .gitignore                  # Git ignore rules
```

---

## Deployment & Usage

### 1. GitHub Pages (Static Web App)
The site is hosted automatically on GitHub Pages at:  
👉 **[https://utsav-soulsensei.github.io/booking-portal/](https://utsav-soulsensei.github.io/booking-portal/)**

- Reads data directly from `Sheet 1` via Google Visualization API (`gviz/tq`).
- Validates leader credentials client-side against the sheet's `Leader Password` column.
- To enable direct writes from GitHub Pages without running a server, deploy `google-apps-script.js` as an Apps Script Web App (instructions included inside the file and in the in-app Settings modal).

### 2. Local Python Server (Optional)
If you prefer running a local server with direct service account permissions:
```bash
git clone https://github.com/utsav-soulsensei/booking-portal.git
cd booking-portal
pip install -r requirements.txt
cp .env.example .env
python3 app.py
```
Access at `http://localhost:5000`.
