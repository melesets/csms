import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DATABASE_URL = os.getenv('DATABASE_URL', '')
PORT = int(os.getenv('PORT', '8000'))
HOST = os.getenv('HOST', '0.0.0.0')

# AI provider — CrewAI uses litellm under the hood
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
OPENAI_API_BASE = os.getenv('OPENAI_API_BASE', 'https://api.openai.com/v1')

GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')

def get_llm_config():
    """Return the best available LLM config for CrewAI."""
    if GROQ_API_KEY:
        return {
            'model': f'groq/{GROQ_MODEL}',
            'api_key': GROQ_API_KEY,
        }
    if OPENAI_API_KEY:
        return {
            'model': f'openai/{OPENAI_MODEL}',
            'api_key': OPENAI_API_KEY,
            'api_base': OPENAI_API_BASE if OPENAI_API_BASE != 'https://api.openai.com/v1' else None,
        }
    if GEMINI_API_KEY:
        return {
            'model': 'gemini/gemini-2.0-flash',
            'api_key': GEMINI_API_KEY,
        }
    return {'model': 'openai/gpt-4o-mini'}  # fallback, will error without key
