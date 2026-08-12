FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Expose to all host interfaces so Docker can forward it
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
