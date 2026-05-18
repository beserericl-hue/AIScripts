FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY app/ ./app/
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 8080

# No Docker HEALTHCHECK — Railway probes /health externally via its
# router (configured via deploy.healthcheckPath in railway.json).
CMD ["/app/start.sh"]
