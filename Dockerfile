# 1. Nginx 기반으로 실행
FROM nginx:alpine

# 2. 현재 위치의 프론트엔드 정적 파일을 Nginx의 정적 파일 폴더로 복사
COPY . /usr/share/nginx/html/

# 3. Nginx 포트 개방
EXPOSE 80

# 4. 컨테이너 실행 시 Nginx 실행
CMD ["nginx", "-g", "daemon off;"]