# 1. 경량화된 Python 3.13 베이스 이미지 채택
FROM python:3.13-slim

# 2. 작업 디렉토리 설정
WORKDIR /app

# 3. 가상환경 없이 컨테이너 내 전역 설치를 위해 requirements.txt 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. 전체 백엔드 소스 파일 복사
COPY . .

# 5. Uvicorn 기본 포트 개방
EXPOSE 8000

# 6. 프로덕션 Uvicorn 웹 서버 구동 (호스트 바인딩 0.0.0.0 설정 필수)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
