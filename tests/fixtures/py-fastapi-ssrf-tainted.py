from fastapi import FastAPI, Request
import requests

app = FastAPI()

@app.get('/proxy')
async def proxy(request: Request):
    target = request.query_params.get('url')
    return requests.get(target).text
