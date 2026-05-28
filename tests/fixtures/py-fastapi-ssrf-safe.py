from fastapi import FastAPI
import requests

app = FastAPI()

ALLOWED = 'https://api.example.com/status'

@app.get('/proxy')
async def proxy():
    return requests.get(ALLOWED).text
