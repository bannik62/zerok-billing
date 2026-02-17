FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
EXPOSE 3001

# Si la base a déjà User/Proof/session (ex. ancien db push), P3005 : on baseline puis deploy.
CMD ["sh", "-c", "npx prisma migrate deploy || (npx prisma migrate resolve --applied 20260216000000_init && npx prisma migrate deploy); exec node server.js"]
