# Use Node.js 18
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy your application code
COPY . .

# Cloud Run provides PORT, but your app listens on 5000 by default.
# If you change your index.js to `const PORT = process.env.PORT || 5000;`, use EXPOSE $PORT
EXPOSE 5000

# Start the app
CMD [ "npm", "start" ]