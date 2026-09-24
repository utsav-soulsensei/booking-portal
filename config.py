import os
try:
    from dotenv import load_dotenv
    if os.path.exists('.env'):
        load_dotenv('.env')
    elif os.path.exists('/home/utsav/.env'):
        load_dotenv('/home/utsav/.env')
except ImportError:
    pass

SPREADSHEET_ID = os.environ.get('SPREADSHEET_ID', '1q-gadAgzT7Rim6p_3GvIPwTj_nznz_IkGrzLG3XP6NI')

# Service account path or JSON content
DEFAULT_SERVICE_ACCOUNT = '/home/utsav/soulsensei-e6c759029da4.json'
SERVICE_ACCOUNT_PATH = os.environ.get('SERVICE_ACCOUNT_PATH', DEFAULT_SERVICE_ACCOUNT)
GOOGLE_SERVICE_ACCOUNT_JSON = os.environ.get('GOOGLE_SERVICE_ACCOUNT_JSON', '')

TAB_PITCH = os.environ.get('TAB_PITCH', 'Sheet1')
TAB_SCHEDULED = os.environ.get('TAB_SCHEDULED', 'Scheduled Appointments')

PORT = int(os.environ.get('PORT', 5000))
DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() in ('true', '1', 't')
