FROM node:18-alpine

WORKDIR /app

# Redis와 ScyllaDB 클라이언트 설치
RUN apk add --no-cache python3 make g++ git

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["npm", "start"]