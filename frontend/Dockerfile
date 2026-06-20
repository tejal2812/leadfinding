FROM node:20-alpine AS build
WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy frontend package files
COPY frontend/package*.json ./frontend/

# Install dependencies for frontend workspace
RUN npm ci --workspace=frontend

# Copy frontend files
COPY frontend/ ./frontend/

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the frontend
RUN npm run build --workspace=frontend

FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
