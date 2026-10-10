ARG APP_NAME=web-client
ARG APP_PORTAL=client
ARG VITE_GLOB_API_URL=/api

FROM node:22-bookworm-slim AS builder

ARG APP_NAME
ARG APP_PORTAL
ARG VITE_GLOB_API_URL

ENV CI=true
ENV NODE_OPTIONS=--max-old-space-size=8192
ENV TZ=Asia/Shanghai

WORKDIR /app/vue-admin

RUN npm install --global corepack@latest \
  && corepack enable \
  && corepack prepare pnpm@11.7.0 --activate

COPY vue-admin .
COPY iam /app/iam

RUN pnpm install --frozen-lockfile
RUN printf 'VITE_GLOB_API_URL=%s\nVITE_APP_PORTAL=%s\nVITE_ARCHIVER=false\n' "$VITE_GLOB_API_URL" "$APP_PORTAL" > "apps/${APP_NAME}/.env.production.local"
RUN pnpm --filter "@vben/${APP_NAME}" build

FROM nginx:stable-alpine AS runtime

ARG APP_NAME

COPY --from=builder /app/vue-admin/apps/${APP_NAME}/dist /usr/share/nginx/html
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  client_max_body_size 25m;' \
  '  location ~ ^/api/client/companies/[0-9]+/high-tech-application/ip-summary/recognize-pdfs$ {' \
  '    rewrite ^/api/(.*)$ /$1 break;' \
  '    proxy_pass http://backend:3000;' \
  '    proxy_read_timeout 2400s;' \
  '    client_max_body_size 32m;' \
  '    proxy_http_version 1.1;' \
  '    proxy_set_header Host $host;' \
  '    proxy_set_header X-Real-IP $remote_addr;' \
  '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
  '    proxy_set_header X-Forwarded-Proto $scheme;' \
  '  }' \
  '  location = /api {' \
  '    proxy_pass http://backend:3000/;' \
  '    proxy_http_version 1.1;' \
  '    proxy_set_header Host $host;' \
  '    proxy_set_header X-Real-IP $remote_addr;' \
  '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
  '    proxy_set_header X-Forwarded-Proto $scheme;' \
  '  }' \
  '  location /api/ {' \
  '    proxy_pass http://backend:3000/;' \
  '    proxy_http_version 1.1;' \
  '    proxy_set_header Host $host;' \
  '    proxy_set_header X-Real-IP $remote_addr;' \
  '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
  '    proxy_set_header X-Forwarded-Proto $scheme;' \
  '  }' \
  '  location /uploads/ {' \
  '    proxy_pass http://backend:3000;' \
  '    proxy_http_version 1.1;' \
  '    proxy_set_header Host $host;' \
  '    proxy_set_header X-Real-IP $remote_addr;' \
  '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
  '    proxy_set_header X-Forwarded-Proto $scheme;' \
  '  }' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
