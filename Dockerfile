# 카나리 서버 이미지 (API와 워커가 같은 이미지를 쓴다 - 실행 명령만 다름)
#
# 멀티 스테이지: 빌드 도구(typescript, nest-cli)는 빌드 단계에만 있고
# 최종 이미지에는 컴파일된 dist와 운영 의존성만 남긴다. 이미지가 작아야
# ECR 푸시와 ECS 배포가 빠르고, 공격 표면도 줄어든다.

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build \
  && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# 컨테이너는 root로 돌리지 않는다 (이미지가 뚫려도 권한을 제한)
USER node

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

EXPOSE 3000

# 기본은 API. 워커는 태스크 정의에서 command를 ["node","dist/worker.js"]로 바꾼다
CMD ["node", "dist/main.js"]
