FROM python:3.11-slim
WORKDIR /app

COPY apps/agents/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/agents/src ./src

EXPOSE 8001
CMD ["uvicorn", "server:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8001"]
