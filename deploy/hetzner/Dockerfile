# Independent Missing AI backend. No Orchestryn secrets, volumes or shared services.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3101
COPY package.json ./
COPY shared ./shared
COPY server ./server
USER node
EXPOSE 3101
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3101/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
