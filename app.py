#!/usr/bin/env python3
"""SoulSensei Leader Appointment Portal Backend.

Allows leaders to log in using their password (last 4 digits of phone or 8888),
view learners who have sessions with them from Sheet 1, and schedule future
appointments directly into the Google Sheet's 'Scheduled Appointments' tab.
"""

import json
import os
import re
from datetime import datetime, timedelta, timezone
from flask import Flask, jsonify, render_template, request

import gspread
from google.oauth2.service_account import Credentials

import config

app = Flask(__name__, static_folder='static', template_folder='templates')

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
]

SCHEDULED_HEADERS = [
    'Timestamp',
    'Leader Name',
    'One on One Name',
    'One on One Config ID',
    'User ID',
    'User Name',
    'Scheduled Date and Time',
    'Notes',
    'Status',
]


def ist_now_str():
    """Return current timestamp in IST."""
    ist_time = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    return ist_time.strftime('%Y-%m-%d %H:%M:%S')


def get_gspread_client():
    """Return an authenticated gspread client."""
    if config.GOOGLE_SERVICE_ACCOUNT_JSON:
        info = json.loads(config.GOOGLE_SERVICE_ACCOUNT_JSON)
        creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    elif os.path.exists(config.SERVICE_ACCOUNT_PATH):
        creds = Credentials.from_service_account_file(config.SERVICE_ACCOUNT_PATH, scopes=SCOPES)
    else:
        raise FileNotFoundError(f"Service account file not found at {config.SERVICE_ACCOUNT_PATH}")
    return gspread.authorize(creds)


def get_spreadsheet():
    gc = get_gspread_client()
    return gc.open_by_key(config.SPREADSHEET_ID)


def ensure_scheduled_tab(sh):
    """Ensure the 'Scheduled Appointments' worksheet exists with headers."""
    for ws in sh.worksheets():
        if ws.title == config.TAB_SCHEDULED:
            return ws
    ws = sh.add_worksheet(title=config.TAB_SCHEDULED, rows=100, cols=len(SCHEDULED_HEADERS) + 2)
    ws.update(values=[SCHEDULED_HEADERS], range_name='A1', value_input_option='RAW')
    return ws


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/leaders', methods=['GET'])
def get_leaders():
    """Return a unique list of leader names present on Sheet 1."""
    try:
        sh = get_spreadsheet()
        ws = sh.worksheet(config.TAB_PITCH)
        rows = ws.get_all_values()
        if not rows or len(rows) < 2:
            return jsonify({'success': True, 'leaders': []})

        header = [c.strip() for c in rows[0]]
        leader_col = header.index('Leader Name') if 'Leader Name' in header else 0

        leaders = sorted(list({
            r[leader_col].strip()
            for r in rows[1:]
            if len(r) > leader_col and r[leader_col].strip()
        }))

        return jsonify({'success': True, 'leaders': leaders})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/login', methods=['POST'])
def login():
    """Validate leader password and return associated users from Sheet 1."""
    data = request.get_json() or {}
    leader_name = str(data.get('leader_name', '')).strip()
    password = str(data.get('password', '')).strip()

    if not leader_name or not password:
        return jsonify({'success': False, 'error': 'Leader name and password are required.'}), 400

    try:
        sh = get_spreadsheet()
        ws = sh.worksheet(config.TAB_PITCH)
        rows = ws.get_all_values()
        if not rows or len(rows) < 2:
            return jsonify({'success': False, 'error': 'No data found in Sheet 1.'}), 404

        header = [c.strip() for c in rows[0]]
        col_leader = header.index('Leader Name') if 'Leader Name' in header else 0
        col_ooo = header.index('One on One Name') if 'One on One Name' in header else 1
        col_cfg = header.index('One on One Config ID') if 'One on One Config ID' in header else 2
        col_uid = header.index('User ID') if 'User ID' in header else 3
        col_uname = header.index('User Name') if 'User Name' in header else 4
        col_time = header.index('Session Date and Time') if 'Session Date and Time' in header else 5
        col_pwd = header.index('Leader Password') if 'Leader Password' in header else 6

        # Find rows for this leader
        leader_rows = [
            r for r in rows[1:]
            if len(r) > col_leader and r[col_leader].strip().lower() == leader_name.lower()
        ]

        if not leader_rows:
            return jsonify({'success': False, 'error': f'No sessions found for leader "{leader_name}".'}), 404

        # Validate password (matches any password stored for this leader)
        valid_passwords = {
            r[col_pwd].strip() for r in leader_rows
            if len(r) > col_pwd and r[col_pwd].strip()
        }

        # Normalize password digits
        pwd_clean = re.sub(r'\D', '', password)
        matched = any(
            re.sub(r'\D', '', vp) == pwd_clean or vp == password
            for vp in valid_passwords
        )

        if not matched:
            return jsonify({'success': False, 'error': 'Incorrect password. Please check and try again.'}), 401

        # Extract users for this leader
        users = []
        seen_user_ids = set()
        for r in leader_rows:
            uid = r[col_uid].strip() if len(r) > col_uid else ''
            uname = r[col_uname].strip() if len(r) > col_uname else ''
            ooo_name = r[col_ooo].strip() if len(r) > col_ooo else ''
            cfg_id = r[col_cfg].strip() if len(r) > col_cfg else ''
            sess_time = r[col_time].strip() if len(r) > col_time else ''

            # Include each user session
            users.append({
                'user_id': uid,
                'user_name': uname or f'User #{uid}',
                'oneonone_name': ooo_name,
                'config_id': cfg_id,
                'original_session': sess_time,
            })

        return jsonify({
            'success': True,
            'leader_name': leader_name,
            'users': users,
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/schedule', methods=['POST'])
def schedule_appointment():
    """Save scheduled appointment to the 'Scheduled Appointments' tab."""
    data = request.get_json() or {}

    leader_name = str(data.get('leader_name', '')).strip()
    user_id = str(data.get('user_id', '')).strip()
    user_name = str(data.get('user_name', '')).strip()
    oneonone_name = str(data.get('oneonone_name', '')).strip()
    config_id = str(data.get('config_id', '')).strip()
    scheduled_date_time = str(data.get('scheduled_date_time', '')).strip()
    notes = str(data.get('notes', '')).strip()

    if not leader_name:
        return jsonify({'success': False, 'error': 'Leader name is required.'}), 400
    if not user_name and not user_id:
        return jsonify({'success': False, 'error': 'User selection or identification is required.'}), 400
    if not scheduled_date_time:
        return jsonify({'success': False, 'error': 'Appointment date and time are required.'}), 400

    try:
        sh = get_spreadsheet()
        ws = ensure_scheduled_tab(sh)

        row_payload = [
            ist_now_str(),
            leader_name,
            oneonone_name,
            config_id,
            user_id,
            user_name,
            scheduled_date_time,
            notes,
            'Scheduled',
        ]

        ws.append_rows([row_payload], value_input_option='RAW')

        return jsonify({
            'success': True,
            'message': f'Appointment for {user_name or user_id} scheduled successfully for {scheduled_date_time}!',
            'appointment': {
                'timestamp': row_payload[0],
                'leader_name': leader_name,
                'oneonone_name': oneonone_name,
                'config_id': config_id,
                'user_id': user_id,
                'user_name': user_name,
                'scheduled_date_time': scheduled_date_time,
                'notes': notes,
                'status': 'Scheduled',
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/appointments', methods=['GET'])
def get_scheduled_appointments():
    """Retrieve appointments from 'Scheduled Appointments' tab, optionally filtered by leader."""
    leader_filter = request.args.get('leader', '').strip()
    try:
        sh = get_spreadsheet()
        ws = ensure_scheduled_tab(sh)
        rows = ws.get_all_values()
        if not rows or len(rows) < 2:
            return jsonify({'success': True, 'appointments': []})

        header = [c.strip() for c in rows[0]]
        appointments = []
        for r in rows[1:]:
            if not any(c.strip() for c in r):
                continue
            item = {header[i]: r[i] for i in range(min(len(header), len(r)))}
            if leader_filter:
                if item.get('Leader Name', '').strip().lower() != leader_filter.lower():
                    continue
            appointments.append(item)

        # Reverse so newest are first
        appointments.reverse()
        return jsonify({'success': True, 'appointments': appointments})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=config.PORT, debug=config.DEBUG)
