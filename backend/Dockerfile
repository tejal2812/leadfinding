FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy backend package files
COPY backend/package*.json ./backend/

# Install only production dependencies for backend workspace
RUN npm ci --omit=dev --workspace=backend

# Copy the rest of backend files
COPY backend/ ./backend/

WORKDIR /app/backend

EXPOSE 4000

CMD ["node", "src/index.js"]
