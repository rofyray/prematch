import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / '.env.local')

class SetupError(Exception):
    pass

def required(name: str) -> str:
    value = os.getenv(name, '')
    if not value:
        raise SetupError(f'{name} is not configured.')
    return value

def require_services():
    for name in ('BIFROST_URL', 'BIFROST_VK'):
        required(name)
    if os.getenv('TAVILY_KEYLESS') != '1':
        required('TAVILY_API_KEY')
    if os.getenv('VERCEL'):
        if os.getenv('STORAGE_URL'):
            required('STORAGE_TOKEN')
        else:
            required('REDIS_URL')
