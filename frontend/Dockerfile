FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_PORT=8000
ARG VITE_API_URL=
ARG VITE_PUBLIC_APP_URL=
ENV VITE_API_PORT=$VITE_API_PORT
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PUBLIC_APP_URL=$VITE_PUBLIC_APP_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
    CMD wget --spider --quiet http://127.0.0.1/ || exit 1
