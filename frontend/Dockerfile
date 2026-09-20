FROM python:3.12-slim

WORKDIR /app

COPY index.html .
COPY css/ css/
COPY js/ js/

EXPOSE 8001
CMD ["python", "-m", "http.server", "8001", "--bind", "0.0.0.0"]