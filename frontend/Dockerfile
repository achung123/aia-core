FROM node:22.22.2-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f

ARG APP_UID=1000
ARG APP_GID=1000

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ ./

# Verify TypeScript compilation and production build
RUN npm run build

RUN existing_user="$(awk -F: -v uid="${APP_UID}" '$3 == uid {print $1; exit}' /etc/passwd)" && \
	if [ -n "${existing_user}" ] && [ "${existing_user}" != "app" ]; then deluser "${existing_user}"; fi && \
	existing_group="$(awk -F: -v gid="${APP_GID}" '$3 == gid {print $1; exit}' /etc/group)" && \
	if [ -n "${existing_group}" ] && [ "${existing_group}" != "app" ]; then delgroup "${existing_group}"; fi && \
	addgroup -g "${APP_GID}" -S app && \
	adduser -u "${APP_UID}" -S -D -G app -h /home/app -s /bin/sh app && \
	mkdir -p /home/app && \
	chown -R app:app /app /home/app

EXPOSE 5173

USER app

CMD ["npm", "run", "dev"]
