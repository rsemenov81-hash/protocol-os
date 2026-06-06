# Minimal container for the gemini-remote MCP server (web + iPhone surfaces).
# Zero npm deps — just copy the source and run it.
FROM node:20-slim
WORKDIR /app
COPY package.json server.js ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
