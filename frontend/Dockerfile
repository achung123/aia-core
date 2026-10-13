FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Verify TypeScript compilation and production build
RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "dev"]
